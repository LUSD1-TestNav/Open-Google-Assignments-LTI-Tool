import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './admin/admin.component';
import { TeacherSetupComponent } from './teacher-setup/teacher-setup.component';
import { StudentViewComponent } from './student-view/student-view.component';
import { GraderViewComponent } from './grader-view/grader-view.component';

const routes: Routes = [
  { path: 'app/admin', component: AdminComponent },
  { path: 'app/teacher-setup', component: TeacherSetupComponent },
  { path: 'app/student', component: StudentViewComponent },
  { path: 'app/grader', component: GraderViewComponent },
  { path: '**', redirectTo: 'app/admin' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
