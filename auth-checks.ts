// src/lib/auth-checks.ts
import { supabase } from '@/integrations/supabase/client';

export async function getAccessibleContent(userId: string) {
  // 1. User ke sare active batches fetch karo
  const { data: enrollments } = await supabase
    .from('enrollments') // Yaha apni table ka naam check kar lena
    .select('batch_id')
    .eq('user_id', userId);

  const batchIds = enrollments?.map(e => e.batch_id) || [];

  // 2. Tests fetch karo (Free OR Batch-specific)
  const { data: tests } = await supabase
    .from('tests')
    .select('*')
    .or(`is_free.eq.true,batch_id.in.(${batchIds.join(',')})`);

  // 3. Batches fetch karo
  const { data: batches } = await supabase
    .from('batches')
    .select('*')
    .in('id', batchIds);

  return { tests, batches };
}
