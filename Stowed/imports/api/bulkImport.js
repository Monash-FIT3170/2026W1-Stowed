import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import {
    Sites,
    FloorMaps,
    StorageUnits,
    StorageLocations,
} from "/imports/api/locations/collections";
import { getCallerOrgId, requirePermission } from "/imports/api/userMethods";

const DEFAULT_FLOOR_SIZE = { width: 500, height: 500 };
const DEFAULT_FLOOR_SETTINGS = {
    gridInterval: 1,
    showGrid: true,
    snapToGrid: true,
};
const ALLOWED_STORAGE_UNIT_TYPES = new Set(["shelf", "cabinet", "rack", "drawer", "fridge", "other", "custom"]);

function parseSimpleCsv(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith("<?xml") || trimmed.includes("<Workbook")) {
        return parseSpreadsheetXml(trimmed);
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const parts = line.split(",");
        const obj = {};
        headers.forEach((h, i) => (obj[h] = (parts[i] || "").trim()));
        return obj;
    });
}

function decodeXml(value = "") {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&gt;/g, ">")
        .replace(/&lt;/g, "<")
        .replace(/&amp;/g, "&");
}

function parseSpreadsheetXml(text) {
    const rowMatches = [...text.matchAll(/<Row\b[^>]*>([\s\S]*?)<\/Row>/g)];
    if (rowMatches.length === 0) return [];

    const rows = rowMatches.map((rowMatch) => {
        const cellMatches = [...rowMatch[1].matchAll(/<Cell\b[^>]*>([\s\S]*?)<\/Cell>/g)];
        return cellMatches.map((cellMatch) => {
            const dataMatch = cellMatch[1].match(/<Data\b[^>]*>([\s\S]*?)<\/Data>/);
            return dataMatch ? decodeXml(dataMatch[1].trim()) : "";
        });
    });

    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = (row[i] || "").trim()));
        return obj;
    });
}

function getField(row, ...keys) {
    for (const k of keys) {
        if (!k) continue;
        if (Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
            return row[k];
        }
    }
    return undefined;
}

function getOptionalInteger(value) {
    if (value === undefined || value === null || String(value).trim() === "") return undefined;
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeStorageUnitType(type) {
    const normalized = String(type || "other").trim().toLowerCase();
    return ALLOWED_STORAGE_UNIT_TYPES.has(normalized) ? normalized : "other";
}

function createDefaultShape(orgId) {
    return {
        orgId,
        shapeId: 1,
        name: "rect",
        points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 40 },
            { x: 0, y: 40 },
        ],
        gridReference: { x: 0, y: 0 },
    };
}

async function findOrCreateSite({ orgId, name, description = "", now, siteMap }) {
    const key = name.toLowerCase();
    let siteId = siteMap.get(key);
    if (siteId) return siteId;

    const existing = await Sites.findOneAsync({ orgId, name });
    if (existing) {
        siteMap.set(key, existing._id);
        return existing._id;
    }

    siteId = await Sites.insertAsync({ orgId, name, description, createdAt: now, updatedAt: now });
    siteMap.set(key, siteId);
    return siteId;
}

async function findOrCreateFloorMap({ orgId, siteId, name, now, floorMapMap }) {
    const key = `${siteId}::${name.toLowerCase()}`;
    let floorId = floorMapMap.get(key);
    if (floorId) return floorId;

    const existing = await FloorMaps.findOneAsync({ orgId, siteId, name });
    if (existing) {
        floorMapMap.set(key, existing._id);
        return existing._id;
    }

    floorId = await FloorMaps.insertAsync({
        orgId,
        siteId,
        name,
        imageUrl: "",
        floorSize: DEFAULT_FLOOR_SIZE,
        settings: DEFAULT_FLOOR_SETTINGS,
        createdAt: now,
        updatedAt: now,
    });
    floorMapMap.set(key, floorId);
    return floorId;
}

async function findOrCreateStorageUnit({ orgId, floorMapId, name, type = "other", now, unitMap }) {
    const key = `${floorMapId}::${name.toLowerCase()}`;
    let unitId = unitMap.get(key);
    if (unitId) return unitId;

    const existing = await StorageUnits.findOneAsync({ orgId, floorMapId, name });
    if (existing) {
        unitMap.set(key, existing._id);
        return existing._id;
    }

    unitId = await StorageUnits.insertAsync({
        orgId,
        floorMapId,
        name,
        type: normalizeStorageUnitType(type),
        shape: createDefaultShape(orgId),
        offset: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        createdAt: now,
        updatedAt: now,
    });
    unitMap.set(key, unitId);
    return unitId;
}

async function findOrCreateStorageLocation({ orgId, storageUnitId, name, code, now }) {
    const existing = code
        ? await StorageLocations.findOneAsync({ orgId, code })
        : await StorageLocations.findOneAsync({ orgId, storageUnitId, name });

    if (existing) return { locationId: existing._id, created: false };

    const locationId = await StorageLocations.insertAsync({
        orgId,
        storageUnitId,
        name,
        code,
        createdAt: now,
        updatedAt: now,
    });

    return { locationId, created: true };
}

Meteor.methods({
    async "bulk.importLocations"(csvText) {
        check(csvText, String);

        if (!this.userId) {
            throw new Meteor.Error("not-authorised", "You must be logged in.");
        }

        await requirePermission(this.userId, "locations.manage");

        const orgId = await getCallerOrgId(this.userId);
        if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

        const rows = parseSimpleCsv(csvText);

        const now = new Date();
        const siteMap = new Map();
        const floorMapMap = new Map();
        const unitMap = new Map();

        for (const r of rows) {
            const siteName = getField(r, 'siteName', 'site.name', 'site_name') || "Default Site";
            const floorName = getField(r, 'floorMapName', 'floorMap.name', 'floor_map_name') || "Default Floor";
            const unitName = getField(r, 'storageUnitName', 'storageUnit.name', 'storage_unit_name') || "Unit";
            const unitType = getField(r, 'storageUnitType', 'storageUnit.type', 'storage_unit_type') || "other";
            const locationName = getField(r, 'locationName', 'storageLocation.name', 'location_name') || "Location";
            const locationCode = getField(r, 'locationCode', 'storageLocation.code', 'location_code') || "";

            let siteId = siteMap.get(siteName);
            if (!siteId) {
                siteId = await Sites.insertAsync({ orgId, name: siteName, description: "", createdAt: now, updatedAt: now });
                siteMap.set(siteName, siteId);
            }

            const floorKey = `${siteName}::${floorName}`;
            let floorId = floorMapMap.get(floorKey);
            if (!floorId) {
                floorId = await FloorMaps.insertAsync({ orgId, siteId, name: floorName, imageUrl: "", createdAt: now, updatedAt: now });
                floorMapMap.set(floorKey, floorId);
            }

            const unitKey = `${floorKey}::${unitName}`;
            let unitId = unitMap.get(unitKey);
            if (!unitId) {
                const shape = { orgId, shapeId: 1, name: "rect", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }], gridReference: { x: 0, y: 0 } };

                unitId = await StorageUnits.insertAsync({
                    orgId,
                    floorMapId: floorId,
                    name: unitName,
                    type: unitType,
                    shape,
                    offset: { x: 0, y: 0 },
                    scale: { x: 1, y: 1 },
                    createdAt: now,
                    updatedAt: now,
                });
                unitMap.set(unitKey, unitId);
            }

            await StorageLocations.insertAsync({ orgId, storageUnitId: unitId, name: locationName, code: locationCode, createdAt: now, updatedAt: now });
        }

        return { status: "ok", created: { sites: siteMap.size, floors: floorMapMap.size, units: unitMap.size, locations: rows.length } };
    },

    async "bulk.importProducts"(csvText) {
        check(csvText, String);

        if (!this.userId) {
            throw new Meteor.Error("not-authorised", "You must be logged in.");
        }

        await requirePermission(this.userId, "products.create");
        await requirePermission(this.userId, "locations.manage");

        const orgId = await getCallerOrgId(this.userId);
        if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

        const rows = parseSimpleCsv(csvText);

        const now = new Date();
        let created = 0;
        let skippedDuplicates = 0;
        // default parents for any created locations
        let defaultSiteId = null;
        let defaultFloorId = null;
        let defaultUnitId = null;

        for (const r of rows) {
            const name = r.name || "Unnamed";
            const description = r.description || "";
            const category = r.category || "";
            const brand = r.brand || "";
            const sku = r.sku || "";
            const qrCode = r.qrCode || "";
            const unitCost = parseFloat(r.unitCost || "0") || 0;
            const reorderAt = getOptionalInteger(r.reorderAt);
            const totalQuantity = parseInt(r.totalQuantity || "0", 10) || 0;
            const assignmentsRaw = r.assignments || "";

            const assignments = [];
            if (assignmentsRaw) {
                for (const piece of assignmentsRaw.split(";")) {
                    const [code, qtyStr] = piece.split(":").map((s) => (s || "").trim());
                    const qty = parseInt(qtyStr || "0", 10) || 0;
                    if (!code) continue;
                    let loc = await StorageLocations.findOneAsync({ code });
                    if (!loc) {
                        // create fallback site/floor/unit on first missing location
                        if (!defaultSiteId) {
                            defaultSiteId = await Sites.insertAsync({ orgId, name: "Imported Site", description: "Imported via bulk import", createdAt: now, updatedAt: now });
                        }
                        if (!defaultFloorId) {
                            defaultFloorId = await FloorMaps.insertAsync({ orgId, siteId: defaultSiteId, name: "Imported Floor", imageUrl: "", createdAt: now, updatedAt: now });
                        }
                        if (!defaultUnitId) {
                            const shape = { orgId, shapeId: 1, name: "rect", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }], gridReference: { x: 0, y: 0 } };
                            defaultUnitId = await StorageUnits.insertAsync({ orgId, floorMapId: defaultFloorId, name: "Imported Unit", type: "other", shape, offset: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, createdAt: now, updatedAt: now });
                        }

                        loc = await StorageLocations.insertAsync({ orgId, storageUnitId: defaultUnitId, name: code, code, createdAt: now, updatedAt: now });
                    }
                    assignments.push({ locationId: loc._id, quantity: qty });
                }
            }

            const handler = Meteor.server.method_handlers["products.createWithAssignments"];
            if (!handler) throw new Meteor.Error("server-error", "Products handler not available");

            try {
                await handler.call(this, {
                    name,
                    description,
                    tag: "",
                    category,
                    sku,
                    brand,
                    unitCost,
                    reorderAt,
                    photoUrl: "",
                    images: [],
                    catalogImages: [],
                    qrCode,
                    totalQuantity,
                    assignments,
                });

                created += 1;
            } catch (err) {
                if (err?.error === "duplicate-name") {
                    skippedDuplicates += 1;
                    continue;
                }
                throw err;
            }
        }

        return { status: "ok", created, skippedDuplicates };
    },

    async "bulk.importCombined"(csvText) {
        check(csvText, String);

        if (!this.userId) {
            throw new Meteor.Error("not-authorised", "You must be logged in.");
        }

        await requirePermission(this.userId, "products.create");

        const orgId = await getCallerOrgId(this.userId);
        if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

        const rows = parseSimpleCsv(csvText);

        const now = new Date();
        const siteMap = new Map();
        const floorMapMap = new Map();
        const unitMap = new Map();
        const productGroups = new Map();
        let createdProducts = 0;
        let createdLocations = 0;
        let skippedDuplicateProducts = 0;

        for (const r of rows) {
            // Ensure location hierarchy if provided
            const siteName = (getField(r, 'siteName', 'site.name', 'site_name') || "").trim();
            const floorName = (getField(r, 'floorMapName', 'floorMap.name', 'floor_map_name') || "").trim();
            const unitName = (getField(r, 'storageUnitName', 'storageUnit.name', 'storage_unit_name') || "").trim();
            const unitType = (getField(r, 'storageUnitType', 'storageUnit.type', 'storage_unit_type') || "").trim();
            const locationName = (getField(r, 'locationName', 'storageLocation.name', 'location_name') || "").trim();
            const locationCode = (getField(r, 'locationCode', 'storageLocation.code', 'location_code') || "").trim();

            let siteId = null;
            if (siteName) {
                siteId = await findOrCreateSite({ orgId, name: siteName, now, siteMap });
            }

            let floorId = null;
            if (floorName) {
                const parentSiteId = siteId || await findOrCreateSite({ orgId, name: "Imported Site", now, siteMap });
                floorId = await findOrCreateFloorMap({ orgId, siteId: parentSiteId, name: floorName, now, floorMapMap });
            }

            let unitId = null;
            if (unitName) {
                const parentSiteId = siteId || await findOrCreateSite({ orgId, name: "Imported Site", now, siteMap });
                const parentFloorId = floorId || await findOrCreateFloorMap({ orgId, siteId: parentSiteId, name: "Imported Floor", now, floorMapMap });
                unitId = await findOrCreateStorageUnit({
                    orgId,
                    floorMapId: parentFloorId,
                    name: unitName,
                    type: unitType || "other",
                    now,
                    unitMap,
                });
            }

            // Create the explicit location from this row if provided
            let explicitLocationId = null;
            if (locationCode) {
                const parentSiteId = siteId || await findOrCreateSite({ orgId, name: "Imported Site", now, siteMap });
                const parentFloorId = floorId || await findOrCreateFloorMap({ orgId, siteId: parentSiteId, name: "Imported Floor", now, floorMapMap });
                const targetUnit = unitId || await findOrCreateStorageUnit({
                    orgId,
                    floorMapId: parentFloorId,
                    name: "Imported Unit",
                    type: "other",
                    now,
                    unitMap,
                });
                const result = await findOrCreateStorageLocation({
                    orgId,
                    storageUnitId: targetUnit,
                    name: locationName || locationCode,
                    code: locationCode,
                    now,
                });
                explicitLocationId = result.locationId;
                if (result.created) createdLocations += 1;
            }

            // If product fields exist, create product and assignments
            const name = r.name && r.name.trim();
            if (name) {
                const description = r.description || "";
                const category = r.category || "";
                const brand = r.brand || "";
                const sku = r.sku || "";
                const qrCode = r.qrCode || "";
                const unitCost = parseFloat(r.unitCost || "0") || 0;
                const reorderAt = getOptionalInteger(r.reorderAt);
                const totalQuantity = parseInt(r.totalQuantity || "0", 10) || 0;
                const assignmentsRaw = r.assignments || "";

                const productKey = name.toLowerCase();
                if (!productGroups.has(productKey)) {
                    productGroups.set(productKey, {
                        name,
                        description,
                        category,
                        sku,
                        brand,
                        unitCost,
                        reorderAt,
                        qrCode,
                        totalQuantity: 0,
                        assignments: [],
                    });
                }

                const productGroup = productGroups.get(productKey);
                productGroup.totalQuantity += totalQuantity;

                const assignments = [];
                if (assignmentsRaw) {
                    for (const piece of assignmentsRaw.split(";")) {
                        const [code, qtyStr] = piece.split(":").map((s) => (s || "").trim());
                        const qty = parseInt(qtyStr || "0", 10) || 0;
                        if (!code) continue;
                        let loc = await StorageLocations.findOneAsync({ orgId, code });
                        if (!loc) {
                            // create location under explicit unit if available, else create under defaults
                            const parentSiteId = siteId || await findOrCreateSite({ orgId, name: "Imported Site", now, siteMap });
                            const parentFloorId = floorId || await findOrCreateFloorMap({ orgId, siteId: parentSiteId, name: "Imported Floor", now, floorMapMap });
                            const targetUnit = unitId || await findOrCreateStorageUnit({
                                orgId,
                                floorMapId: parentFloorId,
                                name: "Imported Unit",
                                type: "other",
                                now,
                                unitMap,
                            });
                            const result = await findOrCreateStorageLocation({ orgId, storageUnitId: targetUnit, name: code, code, now });
                            loc = { _id: result.locationId };
                            if (result.created) createdLocations += 1;
                        }
                        assignments.push({ locationId: loc._id, quantity: qty });
                    }
                } else if (explicitLocationId) {
                    // if no assignments but explicit location in row, assign all quantity to it
                    assignments.push({ locationId: explicitLocationId, quantity: totalQuantity });
                }

                productGroup.assignments.push(...assignments);
            }
        }

        const handler = Meteor.server.method_handlers["products.createWithAssignments"];
        if (!handler) throw new Meteor.Error("server-error", "Products handler not available");

        for (const product of productGroups.values()) {
            try {
                await handler.call(this, {
                    name: product.name,
                    description: product.description,
                    tag: "",
                    category: product.category,
                    sku: product.sku,
                    brand: product.brand,
                    unitCost: product.unitCost,
                    reorderAt: product.reorderAt,
                    photoUrl: "",
                    images: [],
                    catalogImages: [],
                    qrCode: product.qrCode,
                    totalQuantity: product.totalQuantity,
                    assignments: product.assignments,
                });

                createdProducts += 1;
            } catch (err) {
                if (err?.error === "duplicate-name") {
                    skippedDuplicateProducts += 1;
                    continue;
                }
                throw err;
            }
        }

        return { status: "ok", createdProducts, createdLocations, skippedDuplicateProducts };
    },
});
