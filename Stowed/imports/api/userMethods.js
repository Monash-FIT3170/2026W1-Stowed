import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import bcrypt from 'bcrypt';
import { Users } from './users';

const SALT_ROUNDS = 10;

Meteor.methods({
  async 'users.register'({ username, email, password, isAdmin }) {
    check(username, String);
    check(email, String);
    check(password, String);
    check(isAdmin, Boolean);

    if (password.length < 6) {
      throw new Meteor.Error('password-too-short', 'Password must be at least 6 characters.');
    }
    if (!/^.+@.+\..+$/.test(email)) {
      throw new Meteor.Error('invalid-email', 'Please enter a valid email address.');
    }

    // Check for duplicate using the actual stored fields
    const existing = await Users.findOneAsync({
      $or: [
        { 'emails.address': email.toLowerCase() },
        { username },
      ],
    });
    if (existing) {
      throw new Meteor.Error('user-exists', 'A user with that email or username already exists.');
    }

    const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);

    const now = new Date();
    const userId = await Users.insertAsync({
      username,
      emails: [{ address: email, verified: false }],
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
      isAdmin,
    });

    // Return a safe object (still include the plain email for the client)
    return { _id: userId, username, email };
  },

  async 'users.login'({ login, password }) {
    check(login, String);
    check(password, String);

    // Look up by emails.address or username
    const user = await Users.findOneAsync({
      $or: [
        { 'emails.address': login.toLowerCase() },
        { username: login },
      ],
    });

    if (!user) {
      throw new Meteor.Error('user-not-found', 'No account found.');
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      throw new Meteor.Error('wrong-password', 'Incorrect password.');
    }

    // Log the user in (creates a persistent session)
    this.setUserId(user._id);

    // Return safe data – grab the first email address if present
    const email = user.emails?.[0]?.address || '';
    return { _id: user._id, username: user.username, email };
  },

    // checks whether a role can perform a specific action
  async 'users.hasAccess'({ role, method }) {
    check(role, String);
    check(method, String);

    const permissions = {
      owner: [
        'view-registration-page',
      ],

      admin: [
      ],

      user: [
      ],
    };

    return permissions[role]?.includes(method) ?? false;
  },

  // returns the role of the user
  async 'users.getRole'({ userId }) {
    check(userId, String);

    const user = await Users.findOneAsync(userId);

    if (!user) {
      throw new Meteor.Error('user-not-found', 'User does not exist.');
    }

    return user.role;
  }
});