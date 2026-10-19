import PortfolioGrid from "./PortfolioGrid";
export default function BrandField({
  className = "",
  bright = false,
}: {
  className?: string;
  bright?: boolean;
}) {
  return (
    <div className={`vf-field ${className}`} aria-hidden="true">
      <PortfolioGrid bright={bright} />
    </div>
  );
}
