import Threads from "./reactbits/Threads";

/** Фирменный фон: плавные нити — образ денежного потока, который «тянется» вперёд. */
export default function BrandField({
  className = "",
  bright = false,
}: {
  className?: string;
  bright?: boolean;
}) {
  return (
    <div className={`vf-field ${className}`} aria-hidden="true">
      <Threads
        color="#ef3124"
        accentColor="#ff9a8f"
        lineCount={bright ? 70 : 56}
        amplitude={1.3}
        distance={0.35}
        thickness={0.5}
        softness={1.4}
        speed={0.35}
        waves={0.9}
        angle={18}
        taper={0.9}
        brightness={bright ? 1.5 : 1.15}
        opacity={bright ? 0.95 : 0.75}
      />
    </div>
  );
}
