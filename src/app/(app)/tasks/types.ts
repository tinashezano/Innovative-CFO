export type TaskRow = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimateHours: number | null;
  labels: string | null;
  source: string;
  position: number;
  client: { id: string; name: string; colorTag: string } | null;
  assignee: { id: string; name: string; avatarColor: string } | null;
  subtasks: {
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    assignee: { id: string; name: string; avatarColor: string } | null;
  }[];
};

export type FilterOptions = {
  clients: { id: string; name: string; colorTag: string }[];
  users: { id: string; name: string; avatarColor: string }[];
};
