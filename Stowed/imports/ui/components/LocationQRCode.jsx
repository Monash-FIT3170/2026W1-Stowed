import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildUnitQrUrl } from "/imports/api/products/codes";

/**
 * QR code for a storage unit. Encodes the URL of the unit's detail page,
 * so any camera app (or the in-app scanner) opens it directly.
 */
export function LocationQRCode({ unitId, size = 220, alt, className }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!unitId) return undefined;
    let cancelled = false;
    QRCode.toDataURL(buildUnitQrUrl(window.location.origin, unitId), {
      width: size,
      margin: 1,
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err) => console.error("QR render failed:", err));
    return () => {
      cancelled = true;
    };
  }, [unitId, size]);

  if (!unitId || !dataUrl) return null;
  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt || "Storage unit QR code"}
      className={className}
    />
  );
}
