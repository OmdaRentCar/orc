import { useAgency } from '../../context/AgencyContext';

// The agency's logo (if it has one) and name, styled by the surrounding text
export default function BrandName({ dot = true }: { dot?: boolean }) {
  const { agency } = useAgency();
  return (
    <>
      {agency.logoUrl && <img src={agency.logoUrl} alt="" className="inline-block h-[1.1em] w-auto me-2 align-[-0.15em] rounded" />}
      {agency.name}
      {dot && <span className="text-brand-red">.</span>}
    </>
  );
}
