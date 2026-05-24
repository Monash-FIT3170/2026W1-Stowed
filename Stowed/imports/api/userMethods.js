import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { ROLES } from "./roles";
import { Organisations } from './organisations';
import { Accounts } from 'meteor/accounts-base';

/**
 * Helper methods
 */

// permissions map. outlines the lowest role level with permission to perform said tasks
const PERMISSIONS = {
  // User management
  "create-users": ROLES.OWNER,
  "delete-users": ROLES.OWNER,

  // Product operations
  "products.create":    ROLES.ADMIN,    // create new products + assign locations
  "products.update":    ROLES.ADMIN,    // edit product details / reassign locations
  "products.delete":    ROLES.ADMIN,    // Allow Admin
  "products.restock":   ROLES.STANDARD, // add stock — all staff can do this
  "products.uploadImage": ROLES.ADMIN,  // attach images to products

  // Location structure management (all CRUD across the hierarchy)
  "locations.manage":   ROLES.ADMIN,    // sites, floorMaps, storageUnits, storageLocations

  // Routes
  "route:/inventory":   ROLES.STANDARD,
  "route:/locations":   ROLES.STANDARD,
  "route:/floor-map":   ROLES.STANDARD,
  "route:/lists":       ROLES.STANDARD,
  "route:/qr-codes":    ROLES.ADMIN,
  "route:/forecast":    ROLES.ADMIN,
  "route:/alerts":      ROLES.ADMIN,
  "route:/create-item": ROLES.ADMIN,
  "route:/edit-item":   ROLES.ADMIN,
  "route:/item-detail": ROLES.STANDARD,
  "route:/accounts":    ROLES.OWNER,
};

// returns the role of the user
export async function getRole(userId) {
  if (!userId) return null;
  const user = await Meteor.users.findOneAsync(userId);
  if (!user || !user.profile) { return null; }
  return user.profile.role;}

// check permission
export async function hasPermission( userId, permission ) {
  const role = await getRole(userId);
  if (!role) return false;
  // check permissions map to get the lowest role level with permission
  const requiredRole = PERMISSIONS[permission];
  if (requiredRole == null) return false;
  return role >= requiredRole;
}

/// checks if the user's role is allowed to access something
export function hasClientPermission(role, permission) {
  if (role == null) return false;
  // check permissions map to get the lowest role level with permission
  const requiredRole = PERMISSIONS[permission];
  if (requiredRole == null) return false;
  return role >= requiredRole;
}

// throw if unauthorized
export async function requirePermission( userId, permission ) {
  const allowed = await hasPermission( userId, permission );
  if (!allowed) {
    throw new Meteor.Error(
      "forbidden",
      "Insufficient permissions"
    );
  }
}

// logout helper function
export function logoutUser() {
  Meteor.logout();
}

export async function getCallerOrgId(userId) {
  if (!userId) return null;
  const user = await Meteor.users.findOneAsync(userId);
  return user?.profile?.organisationId ?? null;
}

export async function assertOrgAccess(collection, docId, userId) {
  if (!userId) throw new Meteor.Error('not-authorised', 'You must be logged in.');
  const orgId = await getCallerOrgId(userId);
  if (!orgId) throw new Meteor.Error('no-org', 'Your account is not linked to an organisation.');
  const doc = await collection.findOneAsync(docId);
  if (!doc) throw new Meteor.Error('not-found', 'Document not found.');
  if (doc.orgId !== orgId) throw new Meteor.Error('forbidden', 'Access denied.');
}

/**
 * User Methods
 */
Meteor.methods({
  // user creation method, only to be accessed by admins and owners
  "users.create": async function ({ username, email, password, role }) {
    check(username, String);
    check(email, String);
    check(password, String);
    check(role, Number);

    if (role !== ROLES.STANDARD && role !== ROLES.ADMIN) {
      throw new Meteor.Error("invalid-role", "Role not allowed");
    }

    if (password.length < 6) {
      throw new Meteor.Error("invalid-password", "Password must be at least 6 characters.");
    }

    await requirePermission(this.userId, "create-users");

    const caller = await Meteor.users.findOneAsync(this.userId);
    const organisationId = caller.profile.organisationId;
    if (!organisationId) {
      throw new Meteor.Error('no-org', 'Your account is not linked to an organisation.');
    }

    const emailTaken = await Meteor.users.findOneAsync({
      'emails.address': email.toLowerCase(),
      'profile.organisationId': organisationId,
    });
    if (emailTaken) {
      throw new Meteor.Error('email-taken', 'An account with that email already exists in this organisation.');
    }

    const usernameTaken = await Meteor.users.findOneAsync({
      username,
      'profile.organisationId': organisationId,
    });
    if (usernameTaken) {
      throw new Meteor.Error('username-taken', 'That username is already taken in this organisation.');
    }

    const userId = Accounts.createUser({
      username,
      email,
      password,
      profile: {
        role,
        organisationId,
      },
    });
    return userId;
  },

// user registration method, first user becomes owner
// can be modified to facilitate org id: e.g. backend automatically creates and assigns an organisation ID for 
// each registration (the user who registered becomes the owner), except when the user provides an existing known 
// organisation ID, in which case they become a standard user of that organisation
"users.register": async function ({ username, email, password, orgCode = null }) {
  check(username, String);
  check(email, String);
  check(password, String);
  if (orgCode !== null) check(orgCode, String);

  if (password.length < 6) {
    throw new Meteor.Error("invalid-password", "Password must be at least 6 characters.");
  }

  const userCount = await Meteor.users.find().countAsync();
  let organisationId;
  let role;

  if (userCount === 0) {
    // First user ever → Owner, creates organisation
    role = ROLES.OWNER;
    const code = (orgCode || 'default').toLowerCase();
    const now = new Date();
    organisationId = await Organisations.insertAsync({
      name: code,
      code: code,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    // Subsequent registrations
    if (!orgCode) {
      throw new Meteor.Error('org-required', 'Please provide an organisation code.');
    }
    const codeLower = orgCode.toLowerCase();
    let org = await Organisations.findOneAsync({ code: codeLower });

    if (org) {
    // Organisation already exists: do not allow joining via self‑registration
      throw new Meteor.Error('org-exists', 'An organisation with that code already exists. Contact owner to create an account.');
    }
      // New organisation → create it and become its Owner
      role = ROLES.OWNER;
      const now = new Date();
      organisationId = await Organisations.insertAsync({
        name: codeLower,
        code: codeLower,
        createdAt: now,
        updatedAt: now,
      });
    }

  const userId = Accounts.createUser({
    username,
    email,
    password,
    profile: {
      role,
      organisationId,
    },
  });
  return userId;
},

  // delete accounts method for owner 
"users.delete": async function ({ userId }) {
  check(userId, String);

  await requirePermission(this.userId, "delete-users");

 // fetch the caller's organisation
  const caller = await Meteor.users.findOneAsync(
    this.userId,
    { fields: { 'profile.organisationId': 1 } }
  );

  const target = await Meteor.users.findOneAsync(
    userId,
    { fields: { 'profile.organisationId': 1 } }
  );
  if (!target || target.profile.organisationId !== caller.profile.organisationId) {
    throw new Meteor.Error(
      'forbidden',
      'You can only delete users within your own organisation.'
    );
  }

  await Meteor.users.removeAsync(userId);
  return true;
},
// check organisation method
"users.checkOrganisation": async function ({ orgCode, login }) {
  check(orgCode, String);
  check(login, String);

  // find the organisation
  const org = await Organisations.findOneAsync({ code: orgCode.toLowerCase() });
  if (!org) {
    throw new Meteor.Error('org-not-found', 'Organisation does not exist.');
  }

  // Check that a user with this email/username exists in that organisation
  const user = await Meteor.users.findOneAsync({
    'profile.organisationId': org._id,
    $or: [
      { 'emails.address': login.toLowerCase() },
      { username: login },
    ],
  });

  if (!user) {
    throw new Meteor.Error('user-not-found', 'No account found in this organisation.');
  }

  return true;
},
});