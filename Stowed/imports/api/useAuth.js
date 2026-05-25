import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

/**
 * useAuth
 * tells you if a user is logged in and who they are.
 * returns isLoggedIn, user, username and role
 */
const LOGGED_OUT = { isLoggedIn: false, user: null, username: "", role: null };

export function useAuth() {
  return useTracker(() => {
    // Meteor.userId() / Meteor.user() throw when called outside a method or
    // publication context (e.g. server-side renderToStaticMarkup in tests).
    // Return safe logged-out defaults in that case.
    try {
      if (Meteor.isServer) {
        return {
          isLoggedIn: false,
          user: null,
          username: "",
          role: null,
        };
      }

      const user = Meteor.user();
      const userId = Meteor.userId();
      return {
        isLoggedIn: !!userId,
        user,
        username: user?.username || "",
        role: user?.profile?.role ?? null,
      };
    } catch {
      return LOGGED_OUT;
    }
  });
}
