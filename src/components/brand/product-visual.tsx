import Image from "next/image";
import type { ReactNode } from "react";
import type { ArtKind, ProductImage, ScentFamily } from "@/features/catalog/types";
import { cn } from "@/lib/cn";
import { ProductArt } from "./product-art";

type Props = {
  image: Pick<ProductImage, "src" | "art" | "view"> & { alt: string };
  family?: ScentFamily;
  uid: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  // Shown on drawn placeholders only, never on real photography.
  placeholderTag?: string;
  decorative?: boolean;
  // Drawn behind the photo inside the same blend layer (e.g. an arch).
  backdrop?: ReactNode;
};

// Real product photo when one exists, drawn placeholder otherwise.
//
// Photos are studio shots on white. `mix-blend-multiply` lets the white
// fall away into the warm stage colour behind it. The wrapper paints that
// stage colour itself (bg-beige by default, override via className) so the
// blend still works when a hover transform creates a new stacking context.
export function ProductVisual({
  image,
  family,
  uid,
  sizes,
  priority,
  className,
  placeholderTag,
  decorative,
  backdrop,
}: Props) {
  if (image.src) {
    return (
      <div className={cn("relative overflow-hidden bg-beige", className)}>
        {backdrop}
        <Image
          src={image.src}
          alt={decorative ? "" : image.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-contain p-[7%] mix-blend-multiply"
        />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {backdrop}
      <ProductArt
        art={image.art as ArtKind}
        view={image.view}
        family={family}
        uid={uid}
        label={decorative ? "" : image.alt}
        tagLabel={placeholderTag}
        className="h-full w-full"
      />
    </div>
  );
}
