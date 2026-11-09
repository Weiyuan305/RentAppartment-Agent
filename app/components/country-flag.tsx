"use client";

import { useId } from "react";
import type { CountryId } from "@/lib/rental-data";

function starPoints(cx: number, cy: number, outer: number, inner: number, points: number) {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    coords.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return coords.join(" ");
}

function UnionJack() {
  return (
    <g>
      <rect width="60" height="30" fill="#012169"/>
      <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" strokeWidth="6"/>
      <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="4"/>
      <path d="M30 0 V30 M0 15 H60" stroke="#fff" strokeWidth="10"/>
      <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" strokeWidth="6"/>
    </g>
  );
}

function FlagArt({ countryId, clipId }: { countryId: CountryId; clipId: string }) {
  if (countryId === "uk") return <UnionJack/>;
  if (countryId === "au") {
    return (
      <g clipPath={`url(#${clipId})`}>
        <rect width="60" height="30" fill="#012169"/>
        <svg x="0" y="0" width="30" height="15" viewBox="0 0 60 30">
          <UnionJack/>
        </svg>
        <polygon fill="#fff" points={starPoints(15, 22, 3.4, 1.4, 7)}/>
        <polygon fill="#fff" points={starPoints(40, 6, 1.6, 0.6, 7)}/>
        <polygon fill="#fff" points={starPoints(48, 11, 1.7, 0.65, 7)}/>
        <polygon fill="#fff" points={starPoints(46, 19, 1.5, 0.55, 7)}/>
        <polygon fill="#fff" points={starPoints(38, 16, 1.2, 0.45, 5)}/>
        <polygon fill="#fff" points={starPoints(42, 24, 1.8, 0.7, 7)}/>
      </g>
    );
  }
  if (countryId === "sg") {
    return (
      <g clipPath={`url(#${clipId})`}>
        <rect width="60" height="40" fill="#fff"/>
        <rect width="60" height="20" fill="#EF3340"/>
        <circle cx="16" cy="10" r="7" fill="#fff"/>
        <circle cx="18.4" cy="10" r="5.6" fill="#EF3340"/>
        <polygon fill="#fff" points={starPoints(28, 6.2, 1.5, 0.6, 5)}/>
        <polygon fill="#fff" points={starPoints(31.2, 8.4, 1.5, 0.6, 5)}/>
        <polygon fill="#fff" points={starPoints(32.2, 11.8, 1.5, 0.6, 5)}/>
        <polygon fill="#fff" points={starPoints(30.2, 14.6, 1.5, 0.6, 5)}/>
        <polygon fill="#fff" points={starPoints(26.8, 13.2, 1.5, 0.6, 5)}/>
      </g>
    );
  }
  if (countryId === "my") {
    return (
      <g clipPath={`url(#${clipId})`}>
        {Array.from({ length: 14 }, (_, index) => (
          <rect key={index} y={(index * 30) / 14} width="60" height={30 / 14 + 0.15} fill={index % 2 ? "#fff" : "#CC0001"}/>
        ))}
        <rect width="30" height="15" fill="#010066"/>
        <circle cx="12.2" cy="7.5" r="4.6" fill="#FC0"/>
        <circle cx="13.8" cy="7.5" r="3.6" fill="#010066"/>
        <polygon fill="#FC0" points={starPoints(20, 7.5, 3.1, 1.35, 14)}/>
      </g>
    );
  }
  return (
    <g clipPath={`url(#${clipId})`}>
      <rect width="60" height="40" fill="#DE2910"/>
      <g fill="#fff" transform="translate(30 20)">
        {[0, 72, 144, 216, 288].map(degrees => (
          <ellipse key={degrees} cx="0" cy="-7.2" rx="3.1" ry="6.4" transform={`rotate(${degrees})`}/>
        ))}
        <circle r="2.3"/>
      </g>
    </g>
  );
}

export function CountryFlag({ countryId }: { countryId: CountryId }) {
  const clipId = `flag-${useId().replace(/:/g, "")}`;
  const wide = countryId === "sg" || countryId === "hk";
  return (
    <span className="country-flag">
      <svg viewBox={wide ? "0 0 60 40" : "0 0 60 30"} width="28" height="20" aria-hidden="true" focusable="false">
        <clipPath id={clipId}><rect width={wide ? 60 : 60} height={wide ? 40 : 30}/></clipPath>
        <FlagArt countryId={countryId} clipId={clipId}/>
      </svg>
    </span>
  );
}
