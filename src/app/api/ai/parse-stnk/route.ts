import { NextRequest, NextResponse } from "next/server";
import { parseStnk } from "@/lib/gemini";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as Blob | null;

        if (!file) {
            return NextResponse.json({ error: "File wajib diupload" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType = file.type;

        // Validasi tipe file (optional but good)
        if (!mimeType.startsWith("image/")) {
            return NextResponse.json({ error: "Format file harus gambar" }, { status: 400 });
        }

        const data = await parseStnk({ buffer, mimeType });

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("API Error parse-stnk:", error);
        return NextResponse.json(
            { error: error.message || "Gagal memproses gambar" },
            { status: 500 }
        );
    }
}
