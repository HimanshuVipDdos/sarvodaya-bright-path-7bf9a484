const fs = require('fs');
let code = fs.readFileSync('src/routes/_authenticated/admin.students.tsx', 'utf-8');

const queryInjection = `
  // Query to get extra student details (role and comments)
  const { data: studentDetails } = useQuery({
    queryKey: ["admin", "student-details", selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      
      const [roleRes, commentsRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", selectedStudentId).maybeSingle(),
        supabase.from("live_chat_messages").select("id, message, created_at, live_classes(title)").eq("user_id", selectedStudentId).order("created_at", { ascending: false }).limit(10)
      ]);
      
      return {
        role: roleRes.data?.role || "user",
        comments: commentsRes.data || []
      };
    },
    enabled: !!selectedStudentId
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string, makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Role updated successfully!");
      qc.invalidateQueries({ queryKey: ["admin", "student-details", selectedStudentId] });
    },
    onError: (e) => toast.error(e.message)
  });
`;

code = code.replace(/const selectedStudent = students.find\(\(s\) => s\.id === selectedStudentId\);/, queryInjection + '\n  const selectedStudent = students.find((s) => s.id === selectedStudentId);');

const activityTabRegex = /<TabsContent value="activity" className="space-y-4">[\s\S]*?<\/TabsContent>/;
const newActivityTab = `<TabsContent value="activity" className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                      <Activity className="h-4 w-4 text-blue-500" /> Recent Live Comments
                    </h4>
                    {!studentDetails?.comments?.length ? (
                      <p className="text-sm text-slate-500">No recent comments found.</p>
                    ) : (
                      <div className="space-y-3">
                        {studentDetails.comments.map((c: any) => (
                          <div key={c.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-blue-700 text-xs">{c.live_classes?.title || "Unknown Class"}</span>
                              <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-700">{c.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>`;
code = code.replace(activityTabRegex, newActivityTab);

const profileTabRegex = /<TabsContent value="profile" className="space-y-4">([\s\S]*?)<\/TabsContent>/;
code = code.replace(profileTabRegex, (match, p1) => {
  return `<TabsContent value="profile" className="space-y-4">
${p1}
                  <div className="bg-red-50 border border-red-100 rounded-xl p-5 mt-6">
                    <h4 className="font-bold text-red-700 flex items-center gap-2 mb-2">
                      <ShieldAlert className="h-5 w-5" /> Danger Zone (Admin Access)
                    </h4>
                    <p className="text-xs text-red-600 mb-4">
                      Granting admin access allows this user to modify courses, view all students, and change system settings.
                    </p>
                    <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-red-100 shadow-sm">
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">Current Role: {studentDetails?.role === "admin" ? "Administrator" : "Student"}</div>
                      </div>
                      <Button 
                        size="sm"
                        variant={studentDetails?.role === "admin" ? "destructive" : "default"}
                        onClick={() => toggleAdminMutation.mutate({ userId: selectedStudent.id, makeAdmin: studentDetails?.role !== "admin" })}
                        disabled={toggleAdminMutation.isPending}
                        className={studentDetails?.role !== "admin" ? "bg-red-600 hover:bg-red-700 text-white shadow-sm" : ""}
                      >
                        {toggleAdminMutation.isPending ? "Updating..." : (studentDetails?.role === "admin" ? "Revoke Admin" : "Make Admin")}
                      </Button>
                    </div>
                  </div>
                </TabsContent>`;
});

fs.writeFileSync('src/routes/_authenticated/admin.students.tsx', code);
console.log("Updated admin.students.tsx");
