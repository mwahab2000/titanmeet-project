import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface TransportSettings {
  id?: string;
  event_id: string;
  enabled: boolean;
  mode: string;
  meetup_time: string | null;
  general_instructions: string | null;
}

interface Props {
  settings: TransportSettings;
  onChange: (updates: Partial<TransportSettings>) => void;
  disabled: boolean;
}

const TransportSettingsCard = ({ settings, onChange, disabled }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Transportation Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="transport-enabled">Transportation Enabled</Label>
          <Switch
            id="transport-enabled"
            checked={settings.enabled}
            onCheckedChange={v => onChange({ enabled: v })}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default TransportSettingsCard;
