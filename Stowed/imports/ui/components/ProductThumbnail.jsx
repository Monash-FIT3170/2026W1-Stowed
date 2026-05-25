import React, { useState } from "react";

export function ProductThumbnail({ photoUrl, name, images }) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "?";

  const src = Array.isArray(images) && images.length > 0 ? images[0] : photoUrl;

  if (!src || imgError) {
    return (
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          background: "#F5EFE6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 600,
          color: "#B5532A",
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setImgError(true)}
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "8px",
        objectFit: "contain",
        background: "#F5EFE6",
        flexShrink: 0,
      }}
    />
  );
}
