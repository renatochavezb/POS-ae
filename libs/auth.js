import { configureMongoDns } from "./setupDns";

configureMongoDns();

import NextAuth from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import config from "@/config"
import connectMongo from "./mongo"
import connectMongoose from "./mongoose"
import User from "@/models/User"

export const { handlers, auth, signIn, signOut } = NextAuth({
  
  // Set any random key in .env.local
  secret: process.env.NEXTAUTH_SECRET,
  
  // Add EmailProvider only for server-side usage (not edge-compatible)
  providers: [
    // Follow the "Login with Email" tutorial to set up your email server
    // Requires a MongoDB database. Set MONGODB_URI env variable.
    ...(connectMongo
      ? [
          EmailProvider({
            server: {
              host: "smtp.resend.com",
              port: 465,
              auth: {
                user: "resend",
                pass: process.env.RESEND_API_KEY,
              },
            },
            from: config.resend.fromNoReply,
          }),
          GoogleProvider({
            // Follow the "Login with Google" tutorial to get your credentials
            clientId: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
            async profile(profile) {
              return {
                id: profile.sub,
                name: profile.given_name ? profile.given_name : profile.name,
                email: profile.email,
                image: profile.picture,
                role: "user",
                createdAt: new Date(),
              };
            },
          }),
        ]
      : []),
  ],
  
  // New users will be saved in Database (MongoDB Atlas). Each user (model) has some fields like name, email, image, etc..
  // Requires a MongoDB database. Set MONGODB_URI env variable.
  // Learn more about the model type: https://authjs.dev/concepts/database-models
  ...(connectMongo && { adapter: MongoDBAdapter(connectMongo) }),

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Include user role in JWT token
      if (user) {
        token.role = user.role || "user";
      }

      // Refresh user data if session is updated
      if (trigger === "update" && session?.user && process.env.MONGODB_URI) {
        try {
          await connectMongoose();
          const dbUser = await User.findById(token.sub);
          if (dbUser) {
            token.role = dbUser.role || "user";
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session?.user && token.sub) {
        session.user.id = token.sub;

        // Always fetch fresh role from database
        if (process.env.MONGODB_URI) {
          try {
            await connectMongoose();
            const dbUser = await User.findById(token.sub);
            session.user.role = dbUser?.role || "user";
          } catch (error) {
            console.error("Error fetching user role:", error);
            session.user.role = token.role || "user";
          }
        } else {
          session.user.role = token.role || "user";
        }
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Fallback: ensure existing users have a role
      if (user.id && !user.role && process.env.MONGODB_URI) {
        try {
          await connectMongoose();
          const dbUser = await User.findById(user.id);
          if (dbUser && !dbUser.role) {
            await User.findByIdAndUpdate(user.id, { role: "user" });
            user.role = "user";
          }
        } catch (error) {
          console.error("Error setting fallback role for existing user:", error);
        }
      }
      return true;
    },
  },
  
  events: {
    async createUser({ user }) {
      // Ensure all newly created users have a role
      if (!user.role && process.env.MONGODB_URI) {
        try {
          await connectMongoose();
          await User.findByIdAndUpdate(user.id, { role: "user" });
        } catch (error) {
          console.error("Error setting default role for new user:", error);
        }
      }
    },
  },
  
  session: {
    strategy: "jwt",
  },
  theme: {
    brandColor: config.colors.main,
    // Add you own logo below. Recommended size is rectangle (i.e. 200x50px) and show your logo + name.
    // It will be used in the login flow to display your logo. If you don't add it, it will look faded.
    logo: `https://${config.domainName}/logoAndName.png`,
  },
}); 