import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Henüz yapılmamış ekranlar için tutarlı bir iskele — boş sayfa göstermez. */
export function Placeholder({
  title,
  description,
  day,
}: {
  title: string;
  description: string;
  day: string;
}) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <Card>
        <CardBody className="p-10">
          <Badge variant="outline">{day}</Badge>
          <h1 className="mt-4 text-3xl font-bold text-navy-900">{title}</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-navy-500">
            {description}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
