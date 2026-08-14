const steps = [
  ["upload", "Upload"],
  ["configure", "Set privacy"],
  ["review", "Review"],
  ["complete", "Safe copy"],
] as const;

export function WorkflowSteps({ stage }: { stage: string }) {
  const stageIndex = stage === "prepare" ? 1 : steps.findIndex(([id]) => id === stage);
  return (
    <nav className="workflow-steps" aria-label="Redaction progress">
      {steps.map(([id, label], index) => (
        <div key={id} data-active={index === stageIndex} data-complete={index < stageIndex}>
          <span>{index < stageIndex ? "✓" : index + 1}</span>
          <strong>{label}</strong>
        </div>
      ))}
    </nav>
  );
}
