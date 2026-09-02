import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="page-shell">
      <article className="content-card">
        <h1>服务条款</h1>
        <p>这是心屿 MVP 的基础服务条款样稿，上线前需要法律和合规审核。</p>
        <ul>
          <li>心屿提供 AI 情绪支持与自我梳理服务，不替代真人心理咨询、心理治疗、精神科诊断或医疗服务。</li>
          <li>如果你处于紧急危险中，请立即联系现实中的可信任他人、当地紧急帮助，或前往最近医院/急诊。</li>
          <li>AI 咨询师不会提供投资、法律、医疗、政治、具体重大决策等非心理支持范围的建议。</li>
          <li>单次咨询默认 50 分钟，到期后自动结束并生成总结。</li>
          <li>咨询总结仅供自我回顾，不应作为诊断、评估或治疗依据。</li>
        </ul>
        <Link className="text-button" href="/">返回首页</Link>
      </article>
    </main>
  );
}
