import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";
import {
    Sites,
    FloorMaps,
    StorageUnits,
    StorageLocations,
} from "/imports/api/locations/collections";
import { ImportRecords } from "/imports/api/importRecords/collections";
import { ProductActivities, Products, ProductRecords } from "/imports/api/products/collections";
import { getCallerOrgId, requirePermission } from "/imports/api/userMethods";

const DEFAULT_FLOOR_SIZE = { width: 500, height: 500 };
const IMPORT_PIXELS_PER_METER = 50;
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

function parseBulkImportRows(text) {
    const trimmed = text.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            throw new Meteor.Error("invalid-json", "The import file is not valid JSON.");
        }

        const rows = Array.isArray(parsed) ? parsed : parsed.rows || parsed.items || parsed.data;
        if (!Array.isArray(rows)) {
            throw new Meteor.Error("invalid-json", "JSON imports must be an array, or an object with a rows array.");
        }

        return rows.map((row) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
                throw new Meteor.Error("invalid-json", "Each JSON import row must be an object.");
            }
            return row;
        });
    }

    return parseSimpleCsv(text);
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

function getOptionalNumber(value) {
    if (value === undefined || value === null || String(value).trim() === "") return undefined;
    const parsed = parseFloat(String(value));
    return Number.isNaN(parsed) ? undefined : parsed;
}

function getOptionalDate(value) {
    if (value === undefined || value === null || String(value).trim() === "") return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toImportedFloorSize({ widthMeters, heightMeters }) {
    return {
        width: widthMeters * IMPORT_PIXELS_PER_METER,
        height: heightMeters * IMPORT_PIXELS_PER_METER,
    };
}

function parseAssignmentEntries(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value.map((assignment) => {
            if (!assignment || typeof assignment !== "object") return null;
            const code = getField(assignment, "locationCode", "code", "location_code", "location");
            const quantity = getOptionalInteger(getField(assignment, "quantity", "qty", "totalQuantity", "total_quantity")) || 0;
            return code ? { code: String(code).trim(), quantity } : null;
        }).filter(Boolean);
    }

    if (typeof value === "object") {
        return Object.entries(value).map(([code, quantity]) => ({
            code: String(code).trim(),
            quantity: getOptionalInteger(quantity) || 0,
        })).filter((assignment) => assignment.code);
    }

    return String(value).split(";").map((piece) => {
        const [code, qtyStr] = piece.split(":").map((s) => (s || "").trim());
        return code ? { code, quantity: getOptionalInteger(qtyStr) || 0 } : null;
    }).filter(Boolean);
}

function normalizeStorageUnitType(type) {
    const normalized = String(type || "other").trim().toLowerCase();
    return ALLOWED_STORAGE_UNIT_TYPES.has(normalized) ? normalized : "other";
}

function createDefaultShape(orgId, width = 2, height = 1) {
    return {
        orgId,
        shapeId: 1,
        name: "rect",
        points: [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: height },
            { x: 0, y: height },
        ],
        gridReference: { x: 0, y: 0 },
    };
}

async function findOrCreateSite({ orgId, name, description = "", now, siteMap }) {
    const key = name.toLowerCase();
    let cached = siteMap.get(key);
    if (cached) return cached;

    const existing = await Sites.findOneAsync({ orgId, name });
    if (existing) {
        cached = { id: existing._id, created: false };
        siteMap.set(key, cached);
        return cached;
    }

    const siteId = await Sites.insertAsync({ orgId, name, description, createdAt: now, updatedAt: now });
    cached = { id: siteId, created: true };
    siteMap.set(key, cached);
    return cached;
}

async function findOrCreateFloorMap({ orgId, siteId, name, floorSize, now, floorMapMap }) {
    const key = `${siteId}::${name.toLowerCase()}`;
    let cached = floorMapMap.get(key);
    if (cached) {
        if (floorSize) {
            await FloorMaps.updateAsync(cached.id, { $set: { floorSize, updatedAt: now } });
        }
        return cached;
    }

    const existing = await FloorMaps.findOneAsync({ orgId, siteId, name });
    if (existing) {
        if (floorSize) {
            await FloorMaps.updateAsync(existing._id, { $set: { floorSize, updatedAt: now } });
        }
        cached = { id: existing._id, created: false };
        floorMapMap.set(key, cached);
        return cached;
    }

    const floorId = await FloorMaps.insertAsync({
        orgId,
        siteId,
        name,
        imageUrl: "",
        floorSize: floorSize ?? DEFAULT_FLOOR_SIZE,
        settings: DEFAULT_FLOOR_SETTINGS,
        createdAt: now,
        updatedAt: now,
    });
    cached = { id: floorId, created: true };
    floorMapMap.set(key, cached);
    return cached;
}

async function findOrCreateStorageUnit({ orgId, floorMapId, name, type = "other", offset, width, height, now, unitMap }) {
    const key = `${floorMapId}::${name.toLowerCase()}`;
    let cached = unitMap.get(key);
    if (cached) return cached;

    const existing = await StorageUnits.findOneAsync({ orgId, floorMapId, name });
    if (existing) {
        const updates = { updatedAt: now };
        if (offset) {
            updates.offset = offset;
        }
        if (width !== undefined || height !== undefined) {
            updates.shape = createDefaultShape(
                orgId,
                width ?? 2,
                height ?? 1,
            );
        }
        if (Object.keys(updates).length > 1) {
            await StorageUnits.updateAsync(existing._id, { $set: updates });
        }
        cached = { id: existing._id, created: false };
        unitMap.set(key, cached);
        return cached;
    }

    const unitId = await StorageUnits.insertAsync({
        orgId,
        floorMapId,
        name,
        type: normalizeStorageUnitType(type),
        shape: createDefaultShape(orgId, width ?? 2, height ?? 1),
        offset: offset ?? { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        createdAt: now,
        updatedAt: now,
    });
    cached = { id: unitId, created: true };
    unitMap.set(key, cached);
    return cached;
}

async function findOrCreateStorageLocation({ orgId, storageUnitId, name, code, lastStocktakeAt, now }) {
    const existing = code
        ? await StorageLocations.findOneAsync({ orgId, code })
        : await StorageLocations.findOneAsync({ orgId, storageUnitId, name });

    if (existing) return { locationId: existing._id, created: false };

    const locationId = await StorageLocations.insertAsync({
        orgId,
        storageUnitId,
        name,
        code,
        lastStocktakeAt: lastStocktakeAt ?? now,
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

        const rows = parseBulkImportRows(csvText);

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
            const lastStocktakeAt = getOptionalDate(getField(r, "lastStocktakeAt", "storageLocation.lastStocktakeAt", "last_stocktake_at")) ?? now;

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

            await StorageLocations.insertAsync({ orgId, storageUnitId: unitId, name: locationName, code: locationCode, lastStocktakeAt, createdAt: now, updatedAt: now });
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

        const rows = parseBulkImportRows(csvText);

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
                for (const assignment of parseAssignmentEntries(assignmentsRaw)) {
                    const { code, quantity: qty } = assignment;
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

                        const locationId = await StorageLocations.insertAsync({ orgId, storageUnitId: defaultUnitId, name: code, code, lastStocktakeAt: now, createdAt: now, updatedAt: now });
                        loc = { _id: locationId };
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

    async "bulk.importCombined"(payload) {
        check(payload, Match.OneOf(String, Object));

        const csvText = typeof payload === "string" ? payload : payload.text;
        const fileName = typeof payload === "string" ? "Imported data" : payload.fileName || "Imported data";
        check(csvText, String);
        check(fileName, String);

        if (!this.userId) {
            throw new Meteor.Error("not-authorised", "You must be logged in.");
        }

        await requirePermission(this.userId, "products.create");

        const orgId = await getCallerOrgId(this.userId);
        if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

        const now = new Date();
        const importRecordId = await ImportRecords.insertAsync({
            orgId,
            userId: this.userId,
            fileName,
            status: "running",
            createdIds: {
                productIds: [],
                locationIds: [],
                storageUnitIds: [],
                floorMapIds: [],
                siteIds: [],
            },
            counts: {
                createdProducts: 0,
                createdLocations: 0,
                skippedDuplicateProducts: 0,
            },
            createdAt: now,
            updatedAt: now,
        });

        let rows;
        try {
            rows = parseBulkImportRows(csvText);
        } catch (err) {
            await ImportRecords.updateAsync(importRecordId, {
                $set: {
                    status: "failed",
                    error: err.message || err.reason || String(err),
                    updatedAt: new Date(),
                },
            });
            throw err;
        }

        const siteMap = new Map();
        const floorMapMap = new Map();
        const unitMap = new Map();
        const productGroups = new Map();
        const createdSiteIds = new Set();
        const createdFloorMapIds = new Set();
        const createdStorageUnitIds = new Set();
        const createdLocationIds = new Set();
        const createdProductIds = new Set();
        let createdProducts = 0;
        let createdLocations = 0;
        let skippedDuplicateProducts = 0;

        try {
        for (const r of rows) {
            // Ensure location hierarchy if provided
            const siteName = (getField(r, 'siteName', 'site.name', 'site_name') || "").trim();
            const floorName = (getField(r, 'floorMapName', 'floorMap.name', 'floor_map_name') || "").trim();
            const unitName = (getField(r, 'storageUnitName', 'storageUnit.name', 'storage_unit_name') || "").trim();
            const unitType = (getField(r, 'storageUnitType', 'storageUnit.type', 'storage_unit_type') || "").trim();
            const locationName = (getField(r, 'locationName', 'storageLocation.name', 'location_name') || "").trim();
            const locationCode = (getField(r, 'locationCode', 'storageLocation.code', 'location_code') || "").trim();
            const lastStocktakeAt = getOptionalDate(getField(r, "lastStocktakeAt", "storageLocation.lastStocktakeAt", "last_stocktake_at")) ?? now;
            const floorMapWidth = getOptionalNumber(getField(r, "floorMapWidth", "floorMap.width", "floor_map_width"));
            const floorMapHeight = getOptionalNumber(getField(r, "floorMapHeight", "floorMap.height", "floor_map_height"));
            const floorSize = floorMapWidth !== undefined || floorMapHeight !== undefined
                ? toImportedFloorSize({
                    widthMeters: floorMapWidth ?? 10,
                    heightMeters: floorMapHeight ?? 10,
                })
                : undefined;
            const unitOffsetX = getOptionalNumber(getField(r, "storageUnitOffsetX", "storageUnit.offset.x", "storage_unit_offset_x", "unitX", "x"));
            const unitOffsetY = getOptionalNumber(getField(r, "storageUnitOffsetY", "storageUnit.offset.y", "storage_unit_offset_y", "unitY", "y"));
            const unitOffset = unitOffsetX !== undefined || unitOffsetY !== undefined
                ? { x: unitOffsetX ?? 0, y: unitOffsetY ?? 0 }
                : undefined;
            const unitWidth = getOptionalNumber(getField(r, "storageUnitWidth", "storageUnit.width", "storage_unit_width", "unitWidth", "width"));
            const unitHeight = getOptionalNumber(getField(r, "storageUnitHeight", "storageUnit.height", "storage_unit_height", "unitHeight", "height"));

            let siteId = null;
            if (siteName) {
                const siteResult = await findOrCreateSite({ orgId, name: siteName, now, siteMap });
                siteId = siteResult.id;
                if (siteResult.created) createdSiteIds.add(siteId);
            }

            let floorId = null;
            if (floorName) {
                const parentSiteResult = siteId
                    ? { id: siteId, created: false }
                    : await findOrCreateSite({ orgId, name: "Imported Site", now, siteMap });
                const parentSiteId = parentSiteResult.id;
                if (parentSiteResult.created) createdSiteIds.add(parentSiteId);
                const floorResult = await findOrCreateFloorMap({ orgId, siteId: parentSiteId, name: floorName, floorSize, now, floorMapMap });
                floorId = floorResult.id;
                if (floorResult.created) createdFloorMapIds.add(floorId);
            }

            let unitId = null;
            if (unitName) {
                const parentSiteResult = siteId
                    ? { id: siteId, created: false }
                    : await findOrCreateSite({ orgId, name: "Imported Site", now, siteMap });
                const parentSiteId = parentSiteResult.id;
                if (parentSiteResult.created) createdSiteIds.add(parentSiteId);
                const parentFloorResult = floorId
                    ? { id: floorId, created: false }
                    : await findOrCreateFloorMap({ orgId, siteId: parentSiteId, name: "Imported Floor", floorSize, now, floorMapMap });
                const parentFloorId = parentFloorResult.id;
                if (parentFloorResult.created) createdFloorMapIds.add(parentFloorId);
                const unitResult = await findOrCreateStorageUnit({
                    orgId,
                    floorMapId: parentFloorId,
                    name: unitName,
                    type: unitType || "other",
                    offset: unitOffset,
                    width: unitWidth,
                    height: unitHeight,
                    now,
                    unitMap,
                });
                unitId = unitResult.id;
                if (unitResult.created) createdStorageUnitIds.add(unitId);
            }

            // Create the explicit location from this row if provided
            let explicitLocationId = null;
            if (locationCode) {
                const parentSiteResult = siteId
                    ? { id: siteId, created: false }
                    : await findOrCreateSite({ orgId, name: "Imported Site", now, siteMap });
                const parentSiteId = parentSiteResult.id;
                if (parentSiteResult.created) createdSiteIds.add(parentSiteId);
                const parentFloorResult = floorId
                    ? { id: floorId, created: false }
                    : await findOrCreateFloorMap({ orgId, siteId: parentSiteId, name: "Imported Floor", floorSize, now, floorMapMap });
                const parentFloorId = parentFloorResult.id;
                if (parentFloorResult.created) createdFloorMapIds.add(parentFloorId);
                const targetUnitResult = unitId
                    ? { id: unitId, created: false }
                    : await findOrCreateStorageUnit({
                    orgId,
                    floorMapId: parentFloorId,
                    name: "Imported Unit",
                    type: "other",
                    offset: unitOffset,
                    width: unitWidth,
                    height: unitHeight,
                    now,
                    unitMap,
                });
                const targetUnit = targetUnitResult.id;
                if (targetUnitResult.created) createdStorageUnitIds.add(targetUnit);
                const result = await findOrCreateStorageLocation({
                    orgId,
                    storageUnitId: targetUnit,
                    name: locationName || locationCode,
                    code: locationCode,
                    lastStocktakeAt,
                    now,
                });
                explicitLocationId = result.locationId;
                if (result.created) {
                    createdLocations += 1;
                    createdLocationIds.add(result.locationId);
                }
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
                    for (const assignment of parseAssignmentEntries(assignmentsRaw)) {
                        const { code, quantity: qty } = assignment;
                        let loc = await StorageLocations.findOneAsync({ orgId, code });
                        if (!loc) {
                            // create location under explicit unit if available, else create under defaults
                            const parentSiteResult = siteId
                                ? { id: siteId, created: false }
                                : await findOrCreateSite({ orgId, name: "Imported Site", now, siteMap });
                            const parentSiteId = parentSiteResult.id;
                            if (parentSiteResult.created) createdSiteIds.add(parentSiteId);
                            const parentFloorResult = floorId
                                ? { id: floorId, created: false }
                                : await findOrCreateFloorMap({ orgId, siteId: parentSiteId, name: "Imported Floor", floorSize, now, floorMapMap });
                            const parentFloorId = parentFloorResult.id;
                            if (parentFloorResult.created) createdFloorMapIds.add(parentFloorId);
                            const targetUnitResult = unitId
                                ? { id: unitId, created: false }
                                : await findOrCreateStorageUnit({
                                orgId,
                                floorMapId: parentFloorId,
                                name: "Imported Unit",
                                type: "other",
                                offset: unitOffset,
                                width: unitWidth,
                                height: unitHeight,
                                now,
                                unitMap,
                            });
                            const targetUnit = targetUnitResult.id;
                            if (targetUnitResult.created) createdStorageUnitIds.add(targetUnit);
                            const result = await findOrCreateStorageLocation({ orgId, storageUnitId: targetUnit, name: code, code, lastStocktakeAt, now });
                            loc = { _id: result.locationId };
                            if (result.created) {
                                createdLocations += 1;
                                createdLocationIds.add(result.locationId);
                            }
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
                const productId = await handler.call(this, {
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
                createdProductIds.add(productId);
            } catch (err) {
                if (err?.error === "duplicate-name") {
                    skippedDuplicateProducts += 1;
                    continue;
                }
                throw err;
            }
        }

        await ImportRecords.updateAsync(importRecordId, {
            $set: {
                status: "completed",
                createdIds: {
                    productIds: Array.from(createdProductIds),
                    locationIds: Array.from(createdLocationIds),
                    storageUnitIds: Array.from(createdStorageUnitIds),
                    floorMapIds: Array.from(createdFloorMapIds),
                    siteIds: Array.from(createdSiteIds),
                },
                counts: {
                    createdProducts,
                    createdLocations,
                    skippedDuplicateProducts,
                },
                updatedAt: new Date(),
            },
        });

        return { status: "ok", createdProducts, createdLocations, skippedDuplicateProducts };
        } catch (err) {
            await ImportRecords.updateAsync(importRecordId, {
                $set: {
                    status: "failed",
                    error: err.message || err.reason || String(err),
                    createdIds: {
                        productIds: Array.from(createdProductIds),
                        locationIds: Array.from(createdLocationIds),
                        storageUnitIds: Array.from(createdStorageUnitIds),
                        floorMapIds: Array.from(createdFloorMapIds),
                        siteIds: Array.from(createdSiteIds),
                    },
                    counts: {
                        createdProducts,
                        createdLocations,
                        skippedDuplicateProducts,
                    },
                    updatedAt: new Date(),
                },
            });
            throw err;
        }
    },

    async "bulk.undoLatestImport"() {
        if (!this.userId) {
            throw new Meteor.Error("not-authorised", "You must be logged in.");
        }

        await requirePermission(this.userId, "products.create");
        await requirePermission(this.userId, "locations.manage");

        const orgId = await getCallerOrgId(this.userId);
        if (!orgId) throw new Meteor.Error("no-org", "Your account is not linked to an organisation.");

        const record = await ImportRecords.findOneAsync(
            { orgId, status: "completed" },
            { sort: { createdAt: -1 } },
        );
        if (!record) {
            throw new Meteor.Error("not-found", "There is no completed import to undo.");
        }

        const createdIds = record.createdIds || {};
        const productIds = createdIds.productIds || [];
        const locationIds = createdIds.locationIds || [];
        const storageUnitIds = createdIds.storageUnitIds || [];
        const floorMapIds = createdIds.floorMapIds || [];
        const siteIds = createdIds.siteIds || [];

        const undone = {
            products: 0,
            locations: 0,
            storageUnits: 0,
            floorMaps: 0,
            sites: 0,
        };
        const skipped = {
            locations: 0,
            storageUnits: 0,
            floorMaps: 0,
            sites: 0,
        };

        for (const productId of productIds) {
            const product = await Products.findOneAsync({ _id: productId, orgId });
            if (!product) continue;

            await ProductRecords.removeAsync({ productId });
            await ProductActivities.removeAsync({ orgId, productId });
            await Products.removeAsync(productId);
            undone.products += 1;
        }

        for (const locationId of locationIds) {
            const location = await StorageLocations.findOneAsync({ _id: locationId, orgId });
            if (!location) continue;

            const stillUsed = await ProductRecords.findOneAsync({ locationId });
            if (stillUsed) {
                skipped.locations += 1;
                continue;
            }

            await StorageLocations.removeAsync(locationId);
            undone.locations += 1;
        }

        for (const storageUnitId of storageUnitIds) {
            const storageUnit = await StorageUnits.findOneAsync({ _id: storageUnitId, orgId });
            if (!storageUnit) continue;

            const stillHasLocations = await StorageLocations.findOneAsync({ orgId, storageUnitId });
            if (stillHasLocations) {
                skipped.storageUnits += 1;
                continue;
            }

            await StorageUnits.removeAsync(storageUnitId);
            undone.storageUnits += 1;
        }

        for (const floorMapId of floorMapIds) {
            const floorMap = await FloorMaps.findOneAsync({ _id: floorMapId, orgId });
            if (!floorMap) continue;

            const stillHasUnits = await StorageUnits.findOneAsync({ orgId, floorMapId });
            if (stillHasUnits) {
                skipped.floorMaps += 1;
                continue;
            }

            await FloorMaps.removeAsync(floorMapId);
            undone.floorMaps += 1;
        }

        for (const siteId of siteIds) {
            const site = await Sites.findOneAsync({ _id: siteId, orgId });
            if (!site) continue;

            const stillHasFloors = await FloorMaps.findOneAsync({ orgId, siteId });
            if (stillHasFloors) {
                skipped.sites += 1;
                continue;
            }

            await Sites.removeAsync(siteId);
            undone.sites += 1;
        }

        await ImportRecords.updateAsync(record._id, {
            $set: {
                status: "undone",
                undone,
                skipped,
                undoneAt: new Date(),
                undoneByUserId: this.userId,
                updatedAt: new Date(),
            },
        });

        return { status: "ok", importRecordId: record._id, undone, skipped };
    },
});
