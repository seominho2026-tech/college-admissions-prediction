import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import google.generativeai as genai

# 1. Page Configuration
st.set_page_config(
    page_title="대입 합격 가능성 분석 대시보드",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Style for clean Korean UI
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
    html, body, [class*="css"] {
        font-family: 'Noto Sans KR', sans-serif;
    }
    .main-title {
        font-size: 2.2rem;
        font-weight: 700;
        color: #1E3A8A;
        margin-bottom: 5px;
    }
    .sub-title {
        font-size: 1rem;
        color: #4B5563;
        margin-bottom: 25px;
    }
    .metric-card {
        background-color: #F3F4F6;
        padding: 15px;
        border-radius: 10px;
        border-left: 5px solid #3B82F6;
    }
</style>
""", unsafe_allow_html=True)

# Google Sheets Configuration
SHEET_ID = "1FMbA832ZltzsjlNc0k6gaFaixAnwJBXixNzrxkQKDPM"

# GIDs by grade
GIDS = {
    "1학년": {
        "student": "1757920348",
        "college": "0"
    },
    "2학년": {
        "student": "140088215",
        "college": "57746467"
    }
}

# 2. Data Loading Function with Cache
@st.cache_data(show_spinner="구글 시트에서 데이터를 불러오는 중입니다...")
def load_data(sheet_id, gid):
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    try:
        return pd.read_csv(url)
    except Exception as e:
        st.error(f"데이터 로드 실패: {e}")
        return None

# Sidebar - Grade Selection
st.sidebar.markdown("## ⚙️ 학년 및 학생 선택")
grade_option = st.sidebar.selectbox("학년 선택", ["1학년", "2학년"])

# Load selected grade data
student_gid = GIDS[grade_option]["student"]
college_gid = GIDS[grade_option]["college"]

students_df = load_data(SHEET_ID, student_gid)
colleges_df = load_data(SHEET_ID, college_gid)

if students_df is not None and colleges_df is not None:
    # Handle column names and types safely
    students_df['반'] = students_df['반'].astype(str)
    students_df['이름'] = students_df['이름'].astype(str)
    
    # Sidebar - Class Selection
    classes = sorted(students_df['반'].unique())
    selected_class = st.sidebar.selectbox("반 선택", classes)
    
    # Sidebar - Name Selection
    filtered_names = students_df[students_df['반'] == selected_class]['이름'].unique()
    selected_name = st.sidebar.selectbox("이름 선택", filtered_names)
    
    # Extract student info
    student_row = students_df[(students_df['반'] == selected_class) & (students_df['이름'] == selected_name)].iloc[0]
    
    # Extract Score (using '원점수' in Column E / 5th column)
    student_score = float(student_row['원점수'])
    
    # Main Header
    st.markdown(f"<div class='main-title'>🎓 대입 합격 가능성 분석 대시보드 ({grade_option})</div>", unsafe_allow_html=True)
    st.markdown("<div class='sub-title'>선택한 학년의 커트라인과 학생의 원점수를 비교 분석하여 합격 진단 및 전략을 제안합니다.</div>", unsafe_allow_html=True)
    
    # Display student profile summary
    col1, col2, col3 = st.columns(3)
    with col1:
        st.info(f"👤 **학생 정보**\n\n{grade_option} {selected_class}반 **{selected_name}**")
    with col2:
        st.success(f"📈 **학생 원점수**\n\n## {student_score:.1f} 점")
    with col3:
        # Simple stats from student database
        mean_score = students_df['원점수'].mean()
        rank = (students_df['원점수'] > student_score).sum() + 1
        total_students = len(students_df)
        st.metric("학년 평균 및 석차", f"{mean_score:.1f} 점", f"석차: {rank}/{total_students}등")
        
    st.markdown("---")
    
    # 3. Main Dashboard Filters
    st.markdown("### 🔍 대학 및 모집단위 필터링")
    
    col_f1, col_f2, col_f3 = st.columns(3)
    
    with col_f1:
        regions = ["전체"] + sorted([str(r) for r in colleges_df['지역'].dropna().unique()])
        selected_region = st.selectbox("지역 선택", regions)
        
    with col_f2:
        if selected_region == "전체":
            univ_list = sorted([str(u) for u in colleges_df['대학'].dropna().unique()])
        else:
            univ_list = sorted([str(u) for u in colleges_df[colleges_df['지역'] == selected_region]['대학'].dropna().unique()])
        selected_univ = st.selectbox("대학 선택", ["전체"] + univ_list)
        
    with col_f3:
        search_dept = st.text_input("모집단위(학과) 검색 (예: 컴퓨터, 경영, 의예)", "")
        
    # Apply Filters to College Cut Sheet
    filtered_colleges = colleges_df.copy()
    if selected_region != "전체":
        filtered_colleges = filtered_colleges[filtered_colleges['지역'] == selected_region]
    if selected_univ != "전체":
        filtered_colleges = filtered_colleges[filtered_colleges['대학'] == selected_univ]
    if search_dept:
        filtered_colleges = filtered_colleges[filtered_colleges['모집단위'].str.contains(search_dept, case=False, na=False)]
        
    # Clear index and set display score from Column J (원점수)
    filtered_colleges['원점수'] = pd.to_numeric(filtered_colleges['원점수'], errors='coerce')
    filtered_colleges = filtered_colleges.dropna(subset=['원점수'])
    
    # 4. Data Visualizations
    st.markdown("### 📊 대학 학과별 컷 점수 및 내 위치")
    
    if len(filtered_colleges) == 0:
        st.warning("선택 조건에 부합하는 대학/학과 데이터가 없습니다. 필터를 조정해 주세요.")
    else:
        # Create Plotly Scatter Chart
        fig = go.Figure()
        
        # Calculate diffs and statuses for hover details
        filtered_colleges['차이'] = student_score - filtered_colleges['원점수']
        
        # Assign colors based on availability
        # Blue for safe (score >= cut), Red for unsafe (score < cut)
        colors = ['#1D4ED8' if val >= 0 else '#EF4444' for val in filtered_colleges['차이']]
        
        # Add Scatter points
        fig.add_trace(go.Scatter(
            x=filtered_colleges['모집단위'],
            y=filtered_colleges['원점수'],
            mode='markers',
            marker=dict(
                size=12,
                color=colors,
                line=dict(width=1, color='DarkSlateGrey')
            ),
            text=filtered_colleges.apply(
                lambda r: f"<b>{r['대학']} {r['모집단위']}</b><br>지역: {r['지역']}<br>합격 컷: {r['원점수']}점<br>내 점수와 차이: {r['차이']:.1f}점",
                axis=1
            ),
            hoverinfo='text',
            name="대학 학과별 커트라인"
        ))
        
        # Draw student score horizontal line
        fig.add_hline(
            y=student_score,
            line_dash="dash",
            line_color="#10B981",
            line_width=3,
            annotation_text=f"👉 {selected_name} 학생 원점수 ({student_score:.1f}점)",
            annotation_position="top right",
            annotation_font=dict(size=14, color="#047857", family="Noto Sans KR")
        )
        
        fig.update_layout(
            title=dict(
                text=f"🏢 대학 학과별 컷 분포 (파란 점: 합격 안정권 | 빨간 점: 보완 필요)",
                font=dict(size=16, color="#1F2937", family="Noto Sans KR")
            ),
            xaxis_title="모집단위 (학과)",
            yaxis_title="합격 기준 원점수",
            template="plotly_white",
            height=500,
            hovermode="closest",
            margin=dict(l=40, r=40, t=60, b=40),
            xaxis=dict(tickangle=45)
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        # Table of details
        with st.expander("📝 필터링된 대학 합격 가능성 상세 분석 데이터 정보"):
            display_df = filtered_colleges[['지역', '대학', '모집단위', '원점수', '차이']].copy()
            display_df.columns = ['지역', '대학', '모집단위', '대학 컷(원점수)', '학생 점수 차이']
            
            def style_status(val):
                if val >= 0:
                    return f"🟢 합격 안정 (+{val:.1f})"
                elif val >= -10:
                    return f"🟡 소신/경쟁 (-{abs(val):.1f})"
                else:
                    return f"🔴 모험/불안 (-{abs(val):.1f})"
            
            display_df['합격 판정 및 차이'] = display_df['학생 점수 차이'].apply(style_status)
            st.dataframe(display_df[['지역', '대학', '모집단위', '대학 컷(원점수)', '합격 판정 및 차이']], use_container_width=True)

    st.markdown("---")
    
    # 5. AI Analysis (Gemini API Integration)
    st.markdown("### 🤖 Gemini AI 맞춤형 합격 가능성 및 대입 컨설팅")
    
    # API Key Input
    st.markdown("##### 🔑 Gemini API 인증 설정")
    user_api_key = st.text_input("Gemini API Key를 입력하세요.", type="password", help="Google AI Studio에서 발급받은 API Key를 입력하세요.")
    
    if st.button("🚀 AI 분석 보고서 생성하기", type="primary"):
        if not user_api_key:
            st.warning("AI 분석을 수행하기 위해 Gemini API Key를 입력해 주세요.")
        elif len(filtered_colleges) == 0:
            st.error("분석할 대학 리스트가 비어 있습니다. 필터를 조정하여 분석할 대학을 선택해 주세요.")
        else:
            with st.spinner("Gemini AI가 정밀 분석 보고서를 구성하고 있습니다... (약 10~20초 소요)"):
                try:
                    # Configure SDK using google-generativeai as requested
                    genai.configure(api_key=user_api_key)
                    model = genai.GenerativeModel("gemini-3.5-flash")
                    
                    # Construct data summary for prompt
                    colleges_summary = ""
                    for _, row in filtered_colleges.head(30).iterrows():
                        diff = student_score - row['원점수']
                        status = "합격 안정" if diff >= 0 else "소신 지원" if diff >= -10 else "보완 필요"
                        colleges_summary += f"- [{row['지역']}] {row['대학']} {row['모집단위']} (컷: {row['원점수']}점, 차이: {diff:+.1f}점, 판정: {status})\n"
                        
                    prompt = f"""
당신은 대한민국 고등학교 대입 전문 컨설턴트입니다.
다음 학생의 성적 정보와 학생이 선택한 관심 대학 학과의 커트라인 비교 데이터를 기초로 맞춤형 입시 진단을 내려주세요.

[학생 정보]
- 이름: {selected_name} ({grade_option} {selected_class}반)
- 원점수: {student_score:.1f}점

[관심 대학 합격 컷 비교 데이터]
{colleges_summary}

[보고서 작성 필수 항목 (한글로 마크다운 형식 출력)]
1. **📊 성적 종합 분석 및 위치**: 학생의 점수 강점 분석과 현재 희망 대학들 대비 합격 가능성 포트폴리오(안정/소신/도전) 분포 분석.
2. **🎯 타겟 대학 추천 및 대안 제시**: 지원 가능한 가장 유리한 대학/모집단위와, 소폭 성적 상승 시 진입 가능한 추천 리스트.
3. **📌 학년 맞춤 학습 및 생기부 전략**: {grade_option}에 딱 맞춘 국어/수학/영어 등 내신 및 정시 대비 최우선 보완법과 생활기록부 관리 제언.
4. **💡 입시 컨설턴트 한마디**: 따뜻하면서도 날카로운 총평 및 격려의 메시지.
"""
                    response = model.generate_content(prompt)
                    
                    st.success("✨ AI 컨설팅 보고서가 성공적으로 완성되었습니다!")
                    st.markdown(response.text)
                    
                except Exception as e:
                    st.error(f"Gemini API 호출 중 오류가 발생하였습니다: {e}")
                    st.info("API Key 유효성을 확인해 주시거나 잠시 후 다시 시도해 주세요.")

else:
    st.info("구글 스프레드시트에서 데이터를 로드할 수 없습니다. 시트 ID와 인터넷 연결을 확인해 주세요.")
