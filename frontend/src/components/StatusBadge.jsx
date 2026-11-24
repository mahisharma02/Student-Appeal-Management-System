const styles = {
  SUBMITTED: "blue", UNDER_REVIEW: "amber", RESOLVED: "green", REJECTED: "red",
  ACTIVE: "green", UNASSIGNED: "muted", COMPLETED: "green", INACTIVE: "muted", SUSPENDED: "red"
};
export default function StatusBadge({ status }) {
  const label = (status || "UNKNOWN").replaceAll("_", " ");
  return <span className={`status-badge ${styles[status] || "muted"}`}>{label}</span>;
}