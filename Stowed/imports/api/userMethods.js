import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import bcrypt from 'bcrypt';
import { Users } from './users';

const SALT_ROUNDS = 10;

Meteor.methods({
  async 'users.register'({ username, email, password }) {
    check(username, String);
    check(email, String);
    check(password, String);

    if (password.length < 6) {
      throw new Meteor.Error('password-too-short', 'Password must be at least 6 characters.');
    }
    if (!/^.+@.+\..+$/.test(email)) {
      throw new Meteor.Error('invalid-email', 'Please enter a valid email address.');
    }

    const existing = await Users.findOneAsync({ $or: [{ email }, { username }] });
    if (existing) {
      throw new Meteor.Error('user-exists', 'A user with that email or username already exists.');
    }
    const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);

    const now = new Date();
    const userId = await Users.insertAsync({
      username,
      email,
      password: hashedPassword, 
      createdAt: now,
      updatedAt: now,
    });

    return { _id: userId, username, email };
  },
});