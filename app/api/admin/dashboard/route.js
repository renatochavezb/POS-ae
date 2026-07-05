import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import User from "@/models/User";
import connectMongo from "@/libs/mongoose";

// Force dynamic to avoid caching
export const dynamic = "force-dynamic";

// This route is used to get data for the admin dashboard
export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectMongo();

    // Get all users count
    const usersCount = await User.countDocuments();
    const stats = {
      usersCount,
    };

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Error fetching dashboard data" },
      { status: 500 }
    );
  }
}
