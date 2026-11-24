// Adapter provider AI (AD: provider dapat diganti). API key HANYA di secret Worker — tidak pernah ke frontend.
// Bila tidak ada kredensial provider: mode lokal memakai PenyusunRetrieval (jawaban disusun HANYA dari sumber
// terkurasi yang diambil) — di production tanpa provider, endpoint menjawab 503 secara jujur.
export interface SourcePassage { id: string; title: string; publisher: string; url: string | null; text: string }
export interface ChatResult { text: string; modelRef: string }

const STOPWORDS = new Set(["yang", "dan", "di", "ke", "dari", "untuk", "dengan", "adalah", "saya", "apa", "bagaimana", "apakah", "ini", "itu", "pada", "dalam", "tidak", "ada", "atau", "juga", "akan", "bisa", "harus", "agar", "karena", "saat", "telah", "oleh", "lebih", "dapat", "mohon", "tolong", "jelaskan", "tentang", "kenapa", "mengapa", "kapan", "berapa"]);
export function queryTokens(message: string): string[] {
  return [...new Set(message.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w)))].slice(0, 8);
}

export async function retrieveSources(db: D1Database, message: string, limit = 3): Promise<SourcePassage[]> {
  const tokens = queryTokens(message);
  if (!tokens.length) return [];
  const match = tokens.map((t) => `"${t}"`).join(" OR ");
  try {
    const { results } = await db.prepare(
      `SELECT s.id, s.title, s.publisher, s.url, s.content_text FROM ai_sources_fts f
       JOIN ai_sources s ON s.rowid = f.rowid
       WHERE ai_sources_fts MATCH ? AND s.status = 'active' ORDER BY rank LIMIT ?`
    ).bind(match, limit).all<{ id: string; title: string; publisher: string; url: string | null; content_text: string }>();
    return results.map((r) => ({ id: r.id, title: r.title, publisher: r.publisher, url: r.url, text: r.content_text }));
  } catch { return []; }
}

const DISCLAIMER = "Saya adalah asisten informasi kesehatan SIGERAI, bukan tenaga kesehatan. Informasi ini bersifat edukasi dan bukan diagnosis; untuk keluhan yang menetap atau memburuk, periksalah ke fasilitas kesehatan.";

export class RetrievalComposer {
  // Menyusun jawaban hanya dari potongan sumber yang ditemukan — tanpa pengetahuan di luar sumber.
  compose(question: string, sources: SourcePassage[], screeningContext?: string): ChatResult {
    if (!sources.length && !screeningContext) {
      return { text: `Maaf, saya belum menemukan sumber terkurasi yang membahas hal itu di basis pengetahuan SIGERSEHAT, jadi saya tidak akan mengarang jawaban. Coba gunakan kata kunci lain, atau baca artikel di SIGEREDU. ${DISCLAIMER}`, modelRef: "retrieval-local" };
    }
    const tokens = queryTokens(question);
    const parts: string[] = [];
    if (screeningContext) parts.push(screeningContext);
    for (const s of sources) {
      const sentences = s.text.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 25);
      const relevant = sentences.filter((sen) => tokens.some((t) => sen.toLowerCase().includes(t)));
      const chosen = (relevant.length ? relevant : sentences.slice(0, 2)).slice(0, 3);
      if (chosen.length) parts.push(chosen.join(" "));
    }
    return { text: `${parts.join("\n\n")}\n\n${DISCLAIMER}`, modelRef: "retrieval-local" };
  }
}

export class OpenAICompatibleProvider {
  constructor(private baseUrl: string, private apiKey: string, private model: string) {}
  async complete(system: string, user: string): Promise<ChatResult> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.2 }),
    });
    if (!res.ok) throw new Error(`provider_http_${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("provider_empty");
    return { text, modelRef: this.model };
  }
}

export const SYSTEM_PROMPT = `Anda adalah SIGERAI, asisten informasi kesehatan preventif di platform SIGERSEHAT (Lampung, Indonesia).
ATURAN MUTLAK:
1. Jawab HANYA berdasarkan SUMBER yang diberikan dalam konteks. Bila sumber tidak membahasnya, katakan terus terang bahwa Anda tidak menemukan sumbernya.
2. DILARANG memberikan diagnosis pasti, meresepkan obat, menyebut dosis obat, atau menyuruh memulai/menghentikan/mengubah pengobatan.
3. Bila konteks memuat HASIL SKRINING pengguna, sebutkan kategori risikonya PERSIS sama seperti tertulis; jangan menghitung ulang atau mengubah kategorinya.
4. Untuk tanda bahaya (nyeri dada, sesak berat, kelemahan satu sisi, bicara pelo, pingsan, perdarahan hebat), arahkan segera ke IGD/119.
5. Gunakan Bahasa Indonesia yang sederhana dan ramah. Akhiri dengan pengingat bahwa Anda bukan tenaga kesehatan.
6. Jangan pernah menyebut data pengguna lain; konteks hanya berisi data pengguna ini sendiri.`;

export const EMERGENCY_PATTERNS = ["nyeri dada", "sesak napas berat", "sesak berat", "tidak bisa bernapas", "tidak bisa bernafas", "lumpuh", "wajah mencong", "bicara pelo", "pingsan", "perdarahan hebat", "berdarah hebat", "kejang", "bunuh diri", "mengakhiri hidup", "ingin mati"];
export const PRESCRIPTION_PATTERNS = ["resepkan", "resep obat", "dosis", "berapa mg", "obat apa yang harus", "berikan saya obat", "minta obat"];
export const DIAGNOSIS_LEAK_PATTERNS = [/anda (menderita|mengidap|terdiagnosis|positif)\b/i, /diagnosis anda adalah/i, /anda pasti (sakit|kena)/i];

export function emergencyResponse(): string {
  return "Ini bisa menjadi keadaan gawat darurat. Segera ke IGD rumah sakit terdekat atau hubungi 119 sekarang — jangan menunggu dan jangan menyetir sendiri. Bila ada orang di dekat Anda, minta tolong mereka mendampingi. Setelah keadaan darurat tertangani, Anda dapat kembali ke sini untuk informasi edukasi. SIGERAI tidak dapat membantu menilai kegawatan secara medis.";
}
export function prescriptionRefusal(): string {
  return `Maaf, saya tidak dapat meresepkan obat, menyebut dosis, atau menyarankan memulai/menghentikan obat — itu kewenangan dokter yang memeriksa Anda langsung. Yang dapat saya bantu: menjelaskan informasi umum tentang pencegahan dan gaya hidup dari sumber resmi, atau membantu Anda menyiapkan catatan hasil skrining untuk dibawa saat periksa ke puskesmas/dokter. ${DISCLAIMER}`;
}
