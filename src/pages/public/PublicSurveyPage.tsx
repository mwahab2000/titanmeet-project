import { useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase, edgeFunctionUrl } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question_text: string;
  type: string;
  required: boolean;
  order_index: number;
  settings: Record<string, any>;
}

interface SurveyData {
  survey: { id: string; title: string; description: string | null };
  questions: Question[];
  attendee: { name: string };
  invite_id: string;
}

const PublicSurveyPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchSurvey = useCallback(async () => {
    if (!token) { setError("Invalid link"); setLoading(false); return; }
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("survey-api", {
        body: null,
        method: "GET",
        headers: {},
      });
      const res = await fetch(
        edgeFunctionUrl("survey-api", { action: "get", token })
      );
      const json = await res.json();
      if (!res.ok) {
        if (json.alreadySubmitted) { setAlreadySubmitted(true); }
        else { setError(json.error || "Survey not found"); }
      } else {
        setSurveyData(json);
      }
    } catch {
      setError("Failed to load survey");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchSurvey(); }, [fetchSurvey]);

  const setAnswer = (qId: string, val: any) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const handleSubmit = async () => {
    if (!surveyData || !token) return;
    for (const q of surveyData.questions) {
      if (q.required && (answers[q.id] === undefined || answers[q.id] === "" || answers[q.id] === null)) {
        setError(`Please answer: "${q.question_text}"`);
        return;
      }
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        edgeFunctionUrl("survey-api", { action: "submit" }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, answers }),
        }
      );
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Submit failed"); }
      else { setSubmitted(true); }
    } catch {
      setError("Failed to submit");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (submitted || alreadySubmitted) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <CheckCircle2 className="h-14 w-14 sm:h-16 sm:w-16 text-emerald-500 mx-auto" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {alreadySubmitted ? "Already Submitted" : "Thank You!"}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            {alreadySubmitted
              ? "Your response has already been recorded."
              : "Your response has been recorded. Thank you for your feedback!"}
          </p>
        </div>
      </div>
    );
  }

  if (error && !surveyData) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <AlertCircle className="h-14 w-14 sm:h-16 sm:w-16 text-red-400 mx-auto" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Survey Unavailable</h1>
          <p className="text-slate-500 text-sm sm:text-base">{error}</p>
        </div>
      </div>
    );
  }

  if (!surveyData) return null;

  return (
    <div className="min-h-[100svh] bg-gradient-to-br from-slate-50 to-slate-100 py-6 sm:py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-5 sm:p-6 text-white">
            <h1 className="text-xl sm:text-2xl font-bold">{surveyData.survey.title}</h1>
            {surveyData.survey.description && (
              <p className="mt-2 text-white/80 text-sm">{surveyData.survey.description}</p>
            )}
          </div>
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm text-slate-500">
              Hi <span className="font-medium text-slate-700">{surveyData.attendee.name}</span>, please complete this survey.
            </p>
          </div>
        </div>

        {/* Questions */}
        {surveyData.questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 space-y-3">
            <Label className="text-sm sm:text-base font-semibold text-slate-800 leading-snug">
              <span className="text-emerald-500 mr-2">{idx + 1}.</span>
              {q.question_text || "Untitled Question"}
              {q.required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
          </div>
        ))}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Sticky submit for mobile */}
        <div className="sticky bottom-4 z-10">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-13 sm:h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 active:from-emerald-700 active:to-blue-700 text-white rounded-xl shadow-lg"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit Response"}
          </Button>
        </div>

        <p className="text-center text-xs text-slate-400 pb-2">Powered by TitanMeet</p>
      </div>
    </div>
  );
};

function QuestionInput({ question, value, onChange }: { question: Question; value: any; onChange: (v: any) => void }) {
  const s = question.settings || {};

  switch (question.type) {
    case "yes_no":
      return (
        <RadioGroup value={value ?? ""} onValueChange={onChange} className="space-y-2">
          {["yes", "no"].map((v) => (
            <label key={v} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 active:bg-slate-100 cursor-pointer min-h-[48px] transition-colors">
              <RadioGroupItem value={v} />
              <span className="text-sm font-medium capitalize">{v}</span>
            </label>
          ))}
        </RadioGroup>
      );
    case "single_choice":
      return (
        <RadioGroup value={value ?? ""} onValueChange={onChange} className="space-y-2">
          {(s.options || []).map((opt: any) => (
            <label key={opt.value} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 active:bg-slate-100 cursor-pointer min-h-[48px] transition-colors">
              <RadioGroupItem value={opt.value} />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </RadioGroup>
      );
    case "multi_choice":
      return (
        <div className="space-y-2">
          {(s.options || []).map((opt: any) => (
            <label key={opt.value} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 active:bg-slate-100 cursor-pointer min-h-[48px] transition-colors">
              <Checkbox
                checked={(value || []).includes(opt.value)}
                onCheckedChange={(checked) => {
                  const cur = value || [];
                  onChange(checked ? [...cur, opt.value] : cur.filter((v: string) => v !== opt.value));
                }}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      );
    case "rating_stars":
      return (
        <div className="flex gap-1.5 sm:gap-1 py-1">
          {Array.from({ length: s.max || 5 }, (_, i) => (
            <button key={i} type="button" onClick={() => onChange(i + 1)} className="p-1">
              <Star className={cn("h-8 w-8 sm:h-7 sm:w-7 transition-colors", (value ?? 0) > i ? "fill-yellow-400 text-yellow-400" : "text-slate-300")} />
            </button>
          ))}
        </div>
      );
    case "likert":
      return (
        <div className="flex items-center gap-1.5 flex-wrap py-1">
          {Array.from({ length: (s.max || 5) - (s.min || 1) + 1 }, (_, i) => {
            const v = (s.min || 1) + i;
            const label = s.labels?.[String(v)];
            return (
              <div key={v} className="flex flex-col items-center gap-1">
                <Button variant={value === v ? "default" : "outline"} size="sm" className="h-11 w-11 sm:h-9 sm:w-9 p-0 text-sm" onClick={() => onChange(v)}>
                  {v}
                </Button>
                {label && <span className="text-[10px] text-slate-500 max-w-[60px] text-center leading-tight">{label}</span>}
              </div>
            );
          })}
        </div>
      );
    case "short_text":
      return <Input placeholder={s.placeholder || "Your answer..."} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-12 sm:h-10 text-base sm:text-sm" />;
    case "long_text":
      return <Textarea placeholder={s.placeholder || "Your answer..."} value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} className="text-base sm:text-sm" />;
    case "number":
      return <Input type="number" min={s.min} max={s.max} step={s.step} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} className="w-full sm:w-40 h-12 sm:h-10 text-base sm:text-sm" />;
    case "date":
      return <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full sm:w-52 h-12 sm:h-10 text-base sm:text-sm" />;
    default:
      return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-12 sm:h-10 text-base sm:text-sm" />;
  }
}

export default PublicSurveyPage;
