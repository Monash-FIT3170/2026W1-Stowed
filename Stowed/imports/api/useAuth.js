import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

/**
 * useAuth
 * tells you if a user is logged in and who they are.
 * returns isLoggedIn, user, username and role
 */
export function useAuth() {
  return useTracker(() => {
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
  });
}
