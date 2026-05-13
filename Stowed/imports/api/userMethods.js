import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { ROLES } from "./roles";
import { Accounts } from 'meteor/accounts-base';

/**
 * Helper methods
 */

// permissions map. outlines the lowest role level with permission to perform said tasks
const PERMISSIONS = {
  // methods
  "create-users": ROLES.ADMIN,

  // routes
  "route:/": ROLES.STANDARD,
  "route:/floor-map": ROLES.STANDARD,
  "route:/stocktake": ROLES.STANDARD,
  "route:/lists": ROLES.STANDARD,

  "route:/qr-codes": ROLES.ADMIN,
  "route:/forecast": ROLES.ADMIN,
  "route:/alerts": ROLES.ADMIN,
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
  if (!requiredRole) return false;
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

    // ensure role is valid
    if (role !== ROLES.STANDARD && role !== ROLES.ADMIN) {
      throw new Meteor.Error(
        "invalid-role",
        "Role not allowed"
      );
    }

    // ensure user has permission to perform task
    await requirePermission( this.userId, "create-users" );

    const userId = Accounts.createUser({ // create user
      email,
      username,
      password,
      profile: {
        role,
      },
    });

    return userId;
  },

  // user registration method, first user becomes owner
  // can be modified to facilitate org id: e.g. backend automatically creates and assigns an organisation ID for 
  // each registration (the user who registered becomes the owner), except when the user provides an existing known 
  // organisation ID, in which case they become a standard user of that organisation
  "users.register": async function ({ username, email, password }) {
    check(username, String);
    check(email, String);
    check(password, String);

    // determine role based on existing users
    const userCount = await Meteor.users.find().countAsync();
    const role = userCount === 0
      ? ROLES.OWNER
      : ROLES.STANDARD;

    const userId = Accounts.createUser({ // create user 
      username,
      email,
      password,
      profile: {
        role,
      },
    });

    return userId;
  }
});