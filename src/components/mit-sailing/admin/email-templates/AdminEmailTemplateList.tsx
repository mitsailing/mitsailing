import { AdminTableContainer } from '@/components/mit-sailing/admin/AdminDataRows';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAdminDate } from '@/libs/admin/adminDateFormatting';
import type { AdminEmailTemplateListRow } from '@/libs/email-templates/emailTemplateAdminQueries';
import { Link } from '@/libs/I18nNavigation';

type AdminEmailTemplateListText = Readonly<{
  columnDraft: string;
  columnFamily: string;
  columnPublished: string;
  columnRevisions: string;
  columnTemplate: string;
  edit: string;
  empty: string;
  notPublished: string;
}>;

export function AdminEmailTemplateList(
  props: Readonly<{
    locale: string;
    rows: readonly AdminEmailTemplateListRow[];
    text: AdminEmailTemplateListText;
  }>
) {
  return (
    <AdminTableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{props.text.columnTemplate}</TableHead>
            <TableHead>{props.text.columnFamily}</TableHead>
            <TableHead>{props.text.columnPublished}</TableHead>
            <TableHead>{props.text.columnDraft}</TableHead>
            <TableHead>{props.text.columnRevisions}</TableHead>
            <TableHead className="text-right">{props.text.edit}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.length === 0 ? (
            <TableRow>
              <TableCell
                className="py-8 text-center text-muted-foreground"
                colSpan={6}
              >
                {props.text.empty}
              </TableCell>
            </TableRow>
          ) : (
            props.rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">
                  <Link href={`/admin/email-templates/${row.key}`}>
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>{row.family}</TableCell>
                <TableCell>
                  {formatAdminDate(row.publishedAt, props.locale) ||
                    props.text.notPublished}
                </TableCell>
                <TableCell>
                  {formatAdminDate(row.draftUpdatedAt, props.locale) || ''}
                </TableCell>
                <TableCell>{row.revisionCount}</TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/email-templates/${row.key}`}>
                      {props.text.edit}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </AdminTableContainer>
  );
}
