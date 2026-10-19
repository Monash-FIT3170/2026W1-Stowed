// Keep this import in Meteor's dependency graph. The Rspack development server
// loads its application bundle through Node, which cannot link lazy Meteor
// package submodules on its own.
import "meteor/aldeed:collection2/static";
