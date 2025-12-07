import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fantasy Monster League",
    short_name: "FML",
    description: "Fantasy football with monsterized Premier League players.",
    start_url: "/",
    display: "standalone",
    // orientation removed so users can rotate freely
    background_color: "#020617",
    theme_color: "#22c55e",
    icons: [
      {
        src: "/icons/fml-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/fml-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "apple-touch-icon",
      },
    ],
  };
}