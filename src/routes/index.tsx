import { createFileRoute } from "@tanstack/react-router";
import { WhiskerGame } from "@/components/game/WhiskerGame";

export const Route = createFileRoute("/")({
  // The game draws on a canvas and uses Web Audio: render it only in the browser.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Whisker Rooftops — Cat Parkour Runner" },
      {
        name: "description",
        content: "Leap, slide and wall-run a cat across 30 rooftop levels in six worlds. Collect fish, find hidden stars and unlock 12 cats.",
      },
      { property: "og:title", content: "Whisker Rooftops — Cat Parkour Runner" },
      {
        property: "og:description",
        content: "A charming 2.5D rooftop parkour runner: 30 handcrafted levels, power-ups, combos and collectible cats.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhiskerGame,
});
