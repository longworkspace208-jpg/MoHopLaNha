import { CustomerHeader } from "@/components/customer-header";
export default function CustomerLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <><CustomerHeader />{children}</>; }
