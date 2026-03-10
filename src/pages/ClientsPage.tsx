import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Building2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";

const ClientsPage = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const planLimits = usePlanLimits();
  const { openUpgradeModal } = useUpgradeModal();
  const navigate = useNavigate();

  const handleNewClient = () => {
    if (!planLimits.canCreate("clients")) {
      openUpgradeModal("clients");
      return;
    }
    navigate("/dashboard/clients/new");
  };

  useEffect(() => {
    supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setClients(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage your clients</p>
        </div>
        <Button className="gradient-titan border-0 text-primary-foreground gap-2" onClick={handleNewClient}>
          <Plus className="h-4 w-4" /> New Client
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-2 text-lg font-medium">No clients yet</p>
            <p className="mb-4 text-sm text-muted-foreground">Create your first client to get started</p>
            <Button className="gradient-titan border-0 text-primary-foreground" onClick={handleNewClient}>
              Create Client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id} className="transition-all hover:shadow-lg hover:border-primary/30">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {client.logo_url ? (
                      <img src={client.logo_url} alt={client.name} className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-display text-lg font-semibold">{client.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{client.slug}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/dashboard/clients/${client.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientsPage;
