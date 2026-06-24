import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let config = await prisma.dashboardConfig.findUnique({
      where: { userId: user.id },
    });

    // Create default config if it doesn't exist
    if (!config) {
      config = await prisma.dashboardConfig.create({
        data: {
          userId: user.id,
          layoutJson: { widgets: [] },
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("GET /api/dashboard/config error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { layoutJson } = body;

    if (!layoutJson || typeof layoutJson !== "object") {
      return NextResponse.json(
        { error: "Invalid layoutJson" },
        { status: 400 }
      );
    }

    const config = await prisma.dashboardConfig.upsert({
      where: { userId: user.id },
      update: { layoutJson },
      create: {
        userId: user.id,
        layoutJson,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("PUT /api/dashboard/config error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
