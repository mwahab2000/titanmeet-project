import { useState } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { SurveyList } from "@/components/surveys/SurveyList";
import { SurveyEditor } from "@/components/surveys/SurveyEditor";
import type { Survey } from "@/lib/survey-api";

const SurveySection = () => {
  const { event, isArchived } = useEventWorkspace();
  const { user } = useAuth();
  const [editing, setEditing] = useState<Survey | null>(null);

  if (!event || !user) return null;

  if (editing) {
    return (
      <SurveyEditor
        survey={editing}
        eventId={event.id}
        disabled={isArchived}
        onBack={() => setEditing(null)}
      />
    );
  }

  return (
    <SurveyList
      eventId={event.id}
      userId={user.id}
      disabled={isArchived}
      onEdit={setEditing}
    />
  );
};

export default SurveySection;
