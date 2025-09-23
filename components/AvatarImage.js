import Image from "next/image";

function buildFallbackDataUrl(initial) {
  const safeInitial = initial || "?";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' role='img'>` +
    `<rect width='120' height='120' fill='%231F2937' />` +
    `<text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='%23E5E7EB' font-family='Arial, Helvetica, sans-serif' font-size='56'>${safeInitial}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function AvatarImage({ src, alt, className = "", fallbackInitial, ...imageProps }) {
  const hasSrc = Boolean(src);
  const { unoptimized, ...rest } = imageProps;

  const trimmedAlt = alt?.trim();
  const derivedInitial = trimmedAlt ? trimmedAlt[0].toUpperCase() : "?";
  const initial = fallbackInitial ?? derivedInitial;
  const fallbackSrc = buildFallbackDataUrl(initial);

  return (
    <Image
      src={hasSrc ? src : fallbackSrc}
      alt={alt}
      className={className}
      unoptimized={!hasSrc ? true : unoptimized}
      {...rest}
    />
  );
}
