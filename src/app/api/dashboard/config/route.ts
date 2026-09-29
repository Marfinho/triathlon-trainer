import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { NextRequest, NextResponse } from "next/server";

/** Obergrenze für das gespeicherte Layout – schützt die DB vor Riesen-Payloads. */
const MAX_LAYOUT_BYTES = 64 * 1024;

export async function GET() {
  try {
    const { user: authed, response } = await requireUser();
    if (response) return response;
    const user = { id: authed.userId };

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
    const { user: authed, response } = await requireUser();
    if (response) return response;
    const user = { id: authed.userId };

    const body = await req.json();
    const { layoutJson } = body;

    if (
      !layoutJson ||
      typeof layoutJson !== "object" ||
      JSON.stringify(layoutJson).length > MAX_LAYOUT_BYTES
    ) {
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
