import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="page-shell">
      <article className="content-card">
        <h1>隐私政策</h1>
        <p>这是心屿 MVP 的基础隐私政策样稿，上线前需要法律和合规审核。</p>
        <ul>
          <li>匿名用户的当前咨询会话会保存在本浏览器中，用于刷新或误关后的恢复。</li>
          <li>登录用户的咨询记录、总结和关键片段会用于历史总结展示和删除管理。</li>
          <li>聊天记录和总结默认保存 30 天，到期后应自动删除。</li>
          <li>用户可以删除单次咨询，也可以清空全部历史记录。</li>
          <li>我们不会默认使用用户对话训练模型。如后续用于产品改进，需要单独授权。</li>
          <li>出现自伤、自杀、伤害他人等风险表达时，系统会记录风险事件并停止普通咨询。</li>
        </ul>
        <Link className="text-button" href="/">返回首页</Link>
      </article>
    </main>
  );
}
