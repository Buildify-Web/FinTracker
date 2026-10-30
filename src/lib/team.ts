import { query } from './db';

export type TeamInput = {
  person_name: string;
  role?: string;
  monthly_cost: number | string;
  start_date?: string;
  end_date?: string;
  category_id?: string;
  project_id?: string;
  project_pct?: number | string;
};

// Writes a team member's details and their (single) project split. Shared by create and edit.
export async function saveTeamMember(id: string, b: TeamInput) {
  await query(
    `UPDATE team_costs SET person_name = $2, role = $3, monthly_cost = $4, start_date = $5, end_date = $6, category_id = $7 WHERE id = $1`,
    [id, b.person_name.trim(), b.role || null, b.monthly_cost, b.start_date || null, b.end_date || null, b.category_id || null]
  );
  await query('DELETE FROM team_allocations WHERE team_cost_id = $1', [id]);
  if (b.project_id && Number(b.project_pct) > 0) {
    await query('INSERT INTO team_allocations (team_cost_id, project_id, pct) VALUES ($1, $2, $3)', [
      id,
      b.project_id,
      Math.min(100, Number(b.project_pct))
    ]);
  }
}
