import mongoose from "mongoose";
import { configureMongoDns } from "./setupDns";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const getMongoUris = () =>
  [process.env.MONGODB_URI, process.env.MONGODB_URI_DIRECT].filter(Boolean);

const connectWithUri = async (uri) => {
  configureMongoDns();
  return mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
};

const connectMongo = async () => {
  const uris = getMongoUris();

  if (uris.length === 0) {
    throw new Error(
      "Add the MONGODB_URI environment variable inside .env.local to use mongoose"
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = (async () => {
      let lastError = null;

      for (const uri of uris) {
        try {
          const connection = await connectWithUri(uri);
          return connection;
        } catch (error) {
          lastError = error;
          console.error("Mongoose Client Error: " + error.message);
          await mongoose.disconnect().catch(() => {});
        }
      }

      cached.promise = null;
      throw lastError;
    })();
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

export default connectMongo;
