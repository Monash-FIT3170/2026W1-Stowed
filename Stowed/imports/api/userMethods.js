import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { ROLES } from "./roles";
import { Accounts } from 'meteor/accounts-base';

/**
 * User Methods
 */
Meteor.methods({
  // user creation method, only to be accessed by admins and owners
  "users.create"({ username, email, password, role }) {
    check(username, String);
    check(email, String);
    check(password, String);
    check(role, Number);

    // ensure user is logged in
    if (!this.userId) {
      throw new Meteor.Error("not-authorized", "You must be logged in");
    }
    const currentUser = Meteor.users.findOneAsync(this.userId);
    // ensure user is admin or higher
    if (!currentUser || currentUser.profile?.role < ROLES.ADMIN) {
      throw new Meteor.Error("forbidden", "Only admins can create users");
    }

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

  // user registration method, first user becomes owner (can be modified in the future to facilitate org id)
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