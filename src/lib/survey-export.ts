import ExcelJS from "exceljs";
import type { SurveyInvite } from "./survey-invite-api";
import type { SurveyQuestion } from "./survey-api";

export async function exportSurveyToExcel(
  surveyTitle: string,
  surveyId: string,
  invites: SurveyInvite[],
  questions: SurveyQuestion[],
  answers: any[],
  responses: any[]
) {
  const wb = new ExcelJS.Workbook();
  const today = new Date().toISOString().slice(0, 10);

  // Sheet 1: Responses
  const wsResp = wb.addWorksheet("Responses");
  const qHeaders = questions.map((q) => q.question_text || `Q${q.order_index + 1}`);
  wsResp.columns = [
    { header: "Attendee", key: "name", width: 20 },
    { header: "Email", key: "email", width: 25 },
    { header: "Phone", key: "mobile", width: 18 },
    { header: "Status", key: "status", width: 12 },
    { header: "Submitted At", key: "submitted_at", width: 20 },
    ...qHeaders.map((h, i) => ({ header: h, key: `q_${i}`, width: 25 })),
  ];

  // Build response map: respondent_id -> answers
  const responseMap = new Map<string, any>();
  for (const r of responses) {
    responseMap.set(r.respondent_id, r);
  }

  const answersByResponse = new Map<string, Map<string, any>>();
  for (const a of answers) {
    if (!answersByResponse.has(a.response_id)) answersByResponse.set(a.response_id, new Map());
    answersByResponse.get(a.response_id)!.set(a.question_id, a);
  }

  for (const inv of invites) {
    const row: any = {
      name: inv.attendee_name || "",
      email: inv.attendee_email || "",
      mobile: inv.attendee_mobile || "",
      status: inv.status,
      submitted_at: inv.submitted_at || "",
    };

    // Find response for this attendee
    const resp = responses.find((r: any) => r.respondent_id === inv.attendee_id);
    if (resp) {
      const respAnswers = answersByResponse.get(resp.id);
      questions.forEach((q, i) => {
        const a = respAnswers?.get(q.id);
        if (!a) { row[`q_${i}`] = ""; return; }
        if (a.value_text) row[`q_${i}`] = a.value_text;
        else if (a.value_number !== null && a.value_number !== undefined) row[`q_${i}`] = a.value_number;
        else if (a.value_json) row[`q_${i}`] = JSON.stringify(a.value_json);
        else row[`q_${i}`] = "";
      });
    }

    wsResp.addRow(row);
  }

  // Style header row
  wsResp.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });

  // Sheet 2: Statistics
  const wsStats = wb.addWorksheet("Statistics");
  wsStats.columns = [
    { header: "Question", key: "question", width: 30 },
    { header: "Type", key: "type", width: 15 },
    { header: "Option / Metric", key: "option", width: 25 },
    { header: "Count / Value", key: "count", width: 15 },
    { header: "Percent", key: "percent", width: 12 },
  ];

  const totalSubmitted = invites.filter((i) => i.status === "submitted").length;

  for (const q of questions) {
    const qAnswers = answers.filter((a: any) => a.question_id === q.id);

    if (["single_choice", "multi_choice", "yes_no"].includes(q.type)) {
      const options = q.type === "yes_no"
        ? [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]
        : (q.settings?.options || []);

      const counts: Record<string, number> = {};
      options.forEach((o: any) => { counts[o.value] = 0; });
      qAnswers.forEach((a: any) => {
        if (a.value_text && counts[a.value_text] !== undefined) counts[a.value_text]++;
        if (a.value_json && Array.isArray(a.value_json)) {
          (a.value_json as string[]).forEach((v) => {
            if (counts[v] !== undefined) counts[v]++;
          });
        }
      });

      options.forEach((o: any) => {
        wsStats.addRow({
          question: q.question_text,
          type: q.type,
          option: o.label,
          count: counts[o.value] || 0,
          percent: totalSubmitted > 0 ? `${Math.round(((counts[o.value] || 0) / totalSubmitted) * 100)}%` : "0%",
        });
      });
    } else if (["rating_stars", "likert", "number"].includes(q.type)) {
      const nums = qAnswers.map((a: any) => a.value_number).filter((n: any) => n !== null && n !== undefined);
      const avg = nums.length > 0 ? nums.reduce((s: number, n: number) => s + n, 0) / nums.length : 0;
      wsStats.addRow({ question: q.question_text, type: q.type, option: "Average", count: avg.toFixed(2), percent: "" });
      wsStats.addRow({ question: q.question_text, type: q.type, option: "Responses", count: nums.length, percent: "" });
    } else {
      wsStats.addRow({ question: q.question_text, type: q.type, option: "Text responses", count: qAnswers.length, percent: "" });
    }
  }

  wsStats.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });

  // Sheet 3: Non-responders
  const wsNon = wb.addWorksheet("Non-Responders");
  wsNon.columns = [
    { header: "Attendee", key: "name", width: 20 },
    { header: "Email", key: "email", width: 25 },
    { header: "Phone", key: "mobile", width: 18 },
    { header: "Email Sent", key: "email_sent", width: 12 },
    { header: "WhatsApp Sent", key: "wa_sent", width: 14 },
    { header: "Status", key: "status", width: 12 },
  ];

  invites
    .filter((i) => i.status !== "submitted")
    .forEach((inv) => {
      wsNon.addRow({
        name: inv.attendee_name || "",
        email: inv.attendee_email || "",
        mobile: inv.attendee_mobile || "",
        email_sent: inv.sent_via_email ? "Yes" : "No",
        wa_sent: inv.sent_via_whatsapp ? "Yes" : "No",
        status: inv.status,
      });
    });

  wsNon.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TitanMeet_Survey_${surveyId.slice(0, 8)}_${today}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
