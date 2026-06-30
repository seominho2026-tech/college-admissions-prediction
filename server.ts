import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Simple CSV Parser Helper to parse Google Sheets CSV export
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return [];
  
  // Parse headers
  const headers = parseCSVLine(lines[0]);
  const result: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = values[index]?.trim() || '';
    });
    result.push(obj);
  }
  return result;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result.map(v => v.replace(/^"|"$/g, '').trim());
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Google Sheets integration configuration
  const SHEET_ID = "1FMbA832ZltzsjlNc0k6gaFaixAnwJBXixNzrxkQKDPM";
  const GIDS = {
    "1": {
      student: "1757920348",
      college: "0"
    },
    "2": {
      student: "140088215",
      college: "57746467"
    }
  };

  // API route to load data based on grade
  app.get("/api/load-data", async (req, res) => {
    try {
      const grade = req.query.grade as string;
      if (grade !== "1" && grade !== "2") {
        return res.status(400).json({ error: "Invalid grade selection. Choose '1' or '2'." });
      }

      const config = GIDS[grade];
      const studentUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${config.student}`;
      const collegeUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${config.college}`;

      // Fetch student data
      const studentResponse = await fetch(studentUrl);
      if (!studentResponse.ok) {
        throw new Error(`Failed to fetch student data: ${studentResponse.statusText}`);
      }
      const studentCsv = await studentResponse.text();
      const students = parseCSV(studentCsv);

      // Fetch college data
      const collegeResponse = await fetch(collegeUrl);
      if (!collegeResponse.ok) {
        throw new Error(`Failed to fetch college data: ${collegeResponse.statusText}`);
      }
      const collegeCsv = await collegeResponse.text();
      const colleges = parseCSV(collegeCsv);

      res.json({ students, colleges });
    } catch (error: any) {
      console.error("Error loading data:", error);
      res.status(500).json({ error: error.message || "Failed to load spreadsheet data" });
    }
  });

  // API route for Gemini-powered college analysis
  app.post("/api/analyze", async (req, res) => {
    try {
      const { student, filteredColleges, customApiKey } = req.body;
      
      const apiKey = customApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "Gemini API key is required. Please provide it in the input field or configure GEMINI_API_KEY environment variable." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Prepare data summary for Gemini
      const studentScore = parseFloat(student["원점수"]) || 0;
      const studentName = student["이름"] || "학생";
      const studentGrade = student["학년"] || "";
      const studentClass = student["반"] || "";

      let collegesText = "";
      if (filteredColleges && filteredColleges.length > 0) {
        collegesText = filteredColleges.slice(0, 30).map((c: any) => {
          const cutScore = parseFloat(c["원점수"]) || 0;
          const diff = studentScore - cutScore;
          const status = diff >= 0 ? "합격 안정권" : diff >= -10 ? "소신 지원 가능" : "합격 어려움";
          return `- [${c["지역"]}] ${c["대학"]} ${c["모집단위"]} (컷: ${cutScore}점, 점수차: ${diff > 0 ? "+" : ""}${diff.toFixed(1)}점) -> 판정: ${status}`;
        }).join("\n");
      } else {
        collegesText = "조회 조건에 맞는 대학 정보가 없습니다.";
      }

      const prompt = `
당신은 대한민국 고등학교 대입 진학 전문 컨설턴트입니다. 
다음 학생 정보와 사용자가 필터링한 관심 대학 커트라인 데이터를 토대로 합격 가능성을 과학적이고 객관적으로 분석하고 향후 학습/지원 전략을 구체적으로 제안해 주세요.

[학생 정보]
- 이름: ${studentName} (${studentGrade}학년 ${studentClass}반)
- 학생 원점수: ${studentScore}점

[선택한 대학 모집단위 및 커트라인 정보]
${collegesText}

[작성 가이드라인]
1. 친절하고 객관적인 전문 컨설턴트 톤앤매너로 작성해 주세요. (마크다운 형식 사용)
2. **합격 가능성 종합 진단**: 현재 점수 기준으로 선택한 대학들의 합격 가능성(안정, 소신, 불안) 비율을 보여주고 요약해 주세요.
3. **목표 대학별 맞춤 코멘트**: 강점이 있는 학과나 합격 점수 차이가 근소한 학과를 콕 집어 제안해 주세요.
4. **향후 구체적인 대입 전략**: 
   - 1학년/2학년 학년에 맞는 내신 및 정시 학습 팁을 적어주세요.
   - 생기부, 면접, 논술 등 다른 전형 요소에 대한 제언도 담아주세요.
5. 한글 인코딩이 깨지지 않고 마크다운이 깔끔하게 표시되도록 작성해 주세요.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ analysis: response.text });
    } catch (error: any) {
      console.error("Gemini analysis error:", error);
      res.status(500).json({ error: error.message || "Gemini API 호출에 실패하였습니다." });
    }
  });

  // Serve static files in production / Vite middleware in dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
