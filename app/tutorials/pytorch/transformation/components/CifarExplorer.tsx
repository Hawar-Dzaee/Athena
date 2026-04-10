"use client";

import { useState, useMemo } from "react";
import cifar from "../data/cifar10-samples.json";

interface Sample {
  index: number;
  label: number;
  className: string;
  image: string;
}

const samples = cifar.samples as Sample[];
const classes = cifar.classes as string[];

export default function CifarExplorer() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterClass, setFilterClass] = useState<string>("all");

  const filtered = useMemo(
    () =>
      filterClass === "all"
        ? samples
        : samples.filter((s) => s.className === filterClass),
    [filterClass],
  );

  const sample = filtered[selectedIndex] ?? filtered[0];

  // Keep selectedIndex in bounds when filter changes
  const safeIndex = Math.min(selectedIndex, filtered.length - 1);
  if (safeIndex !== selectedIndex) {
    // will re-render with corrected index
    setSelectedIndex(safeIndex);
  }

  return (
    <div className="not-prose my-8 rounded-xl border border-border bg-card p-6 shadow-sm">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Class filter */}
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          Class
          <select
            value={filterClass}
            onChange={(e) => {
              setFilterClass(e.target.value);
              setSelectedIndex(0);
            }}
            className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by class"
          >
            <option value="all">All classes</option>
            {classes.map((c, i) => (
              <option key={c} value={c}>
                {i} &mdash; {c}
              </option>
            ))}
          </select>
        </label>

        {/* Sample index slider */}
        <label className="flex items-center gap-2 text-sm font-medium text-foreground flex-1 min-w-[200px]">
          Sample
          <input
            type="range"
            min={0}
            max={filtered.length - 1}
            value={safeIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="flex-1 accent-accent"
            aria-label="Select sample index"
          />
          <span className="tabular-nums text-muted-foreground w-12 text-right">
            {safeIndex + 1}/{filtered.length}
          </span>
        </label>
      </div>

      {/* Display */}
      {sample && (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Image */}
          <div className="rounded-lg border border-border bg-muted p-3 flex-shrink-0">
            <img
              src={`data:image/png;base64,${sample.image}`}
              alt={`CIFAR-10 sample: ${sample.className}`}
              width={128}
              height={128}
              className="block"
              style={{ imageRendering: "pixelated" }}
            />
          </div>

          {/* Label info */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-foreground">
                {sample.className}
              </span>
              <span className="rounded-full bg-accent/15 px-3 py-0.5 text-sm font-semibold text-accent tabular-nums">
                label {sample.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Dataset index: {sample.index} &middot; 32&times;32 RGB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
