# Food photography

Drop your real food photographs in this folder. Suggested names and where they're used:

| File | Used for |
|---|---|
| `hero-biryani.jpg` | Home page hero (replaces the emoji plate) |
| `dish-chicken-biryani.jpg` | Biryani picker card |
| `dish-fish-fry.jpg` | Fish dishes |
| `catering.jpg` | Catering page banner |

To use them, swap the emoji `<span>` tiles in `src/components/DishCard.tsx` and
`src/app/page.tsx` for Next.js `<Image>` components, e.g.:

```tsx
import Image from "next/image";
<Image src="/images/dish-chicken-biryani.jpg" alt="Chicken Biryani" width={400} height={300} className="rounded-xl object-cover" />
```

Keep photos warm-lit and on a dark plate — they'll pop against the cream Nati-style palette.