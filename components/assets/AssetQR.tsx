"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Renders a scannable QR encoding the asset's full URL, so scanning it with a
 * phone opens this asset's page. (Spec Screen 4: "search by … QR code".)
 */
export function AssetQR({ path, tag }: { path: string; tag: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}${path}`;
    QRCode.toDataURL(url, { margin: 1, width: 176 })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [path]);

  return (
    <div className="flex flex-col items-center gap-2">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`QR code for ${tag}`}
          width={176}
          height={176}
          className="rounded-md border border-border bg-white p-2"
        />
      ) : (
        <div className="h-44 w-44 animate-pulse rounded-md bg-muted" />
      )}
      <p className="text-xs text-muted-foreground">Scan to open {tag}</p>
    </div>
  );
}
