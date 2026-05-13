import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

export function useAuth() {
  return useTracker(() => {
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