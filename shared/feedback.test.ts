import { describe,expect,it } from 'vitest';
import { feedbackCreateInput,feedbackUpdateInput,validateFeedbackAnalysis } from './feedback';
describe('private product feedback contracts',()=> {
  const input={requestId:'11111111-1111-4111-8111-111111111111',category:'bug',title:'按鈕無法使用',body:'這個讀經按鈕按下去沒有反應，請幫忙確認。',location:'/church-reading',urgency:'blocked',consent:true};
  it('requires explicit AI consent and does not accept member IDs or query strings',()=> {
    expect(feedbackCreateInput.safeParse(input).success).toBe(true);
    for(const bad of [{...input,consent:false},{...input,userId:'forged'},{...input,location:'//outside.test'},{...input,location:'/reading?token=secret'},{...input,body:'短文'}]) expect(feedbackCreateInput.safeParse(bad).success).toBe(false);
  });
  it('uses Unicode code points consistently with PostgreSQL text length',()=> {
    expect(feedbackCreateInput.safeParse({...input,title:'😀a'}).success).toBe(false);
    expect(feedbackCreateInput.safeParse({...input,body:'😀'.repeat(5)}).success).toBe(false);
    expect(feedbackCreateInput.safeParse({...input,title:'😀ab',body:'😀'.repeat(10)}).success).toBe(true);
    expect(feedbackCreateInput.safeParse({...input,title:'😀'.repeat(120),body:'😀'.repeat(5000)}).success).toBe(true);
    expect(feedbackCreateInput.safeParse({...input,title:'😀'.repeat(121)}).success).toBe(false);
    expect(feedbackCreateInput.safeParse({...input,body:'😀'.repeat(5001)}).success).toBe(false);
    expect(feedbackUpdateInput.safeParse({version:1,publicReply:'😀'.repeat(3000)}).success).toBe(true);
    expect(feedbackUpdateInput.safeParse({version:1,publicReply:'😀'.repeat(3001)}).success).toBe(false);
  });
  it('rejects PostgreSQL-incompatible nul and unpaired surrogate text before persistence',()=> {
    expect(feedbackCreateInput.safeParse({...input,title:'abc\0def'}).success).toBe(false);
    expect(feedbackCreateInput.safeParse({...input,body:'abcdefghi\uD800'}).success).toBe(false);
  });
  it('requires version and at least one human change',()=> {
    expect(feedbackUpdateInput.safeParse({version:1}).success).toBe(false);
    expect(feedbackUpdateInput.safeParse({version:1,status:'planned'}).success).toBe(true);
    expect(feedbackUpdateInput.safeParse({version:1,analysis:{}}).success).toBe(false);
  });
  it('rejects injected workflow changes and unsupported quotations',()=> {
    const analysis={category:'bug',summary:'按鈕無反應',urgency:'high',importance:'high',reason:'無法完成讀經',tags:['讀經'],nextAction:'確認按鈕',suggestedPriority:'P1',evidence:['按下去沒有反應']};
    expect(validateFeedbackAnalysis(analysis,input).suggestedPriority).toBe('P1');
    expect(()=>validateFeedbackAnalysis({...analysis,status:'done'},input)).toThrow();
    expect(()=>validateFeedbackAnalysis({...analysis,evidence:['所有會員資料外洩']},input)).toThrow();
    expect(()=>validateFeedbackAnalysis({...analysis,tags:Array(9).fill('a')},input)).toThrow();
  });
});
