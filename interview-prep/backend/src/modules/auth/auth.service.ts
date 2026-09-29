import User from './user.model';
import { Session } from './index.model';
import { hashToken } from '../../common/middleware/auth';
import { NotFoundError, ForbiddenError } from '../../common/filters/error-filter';
import { deleteUserData } from './user-data.service';
export const authService = {
  async logout(token:string) { if(token) await Session.deleteMany({token:hashToken(token)}); },
  async getProfile(userId:string) {
    const user=await User.findOne({_id:userId,isAccountDeleted:false});
    if(!user) throw new NotFoundError('User not found');
    return {id:user._id,email:user.email,name:user.name,role:user.role,preferences:user.preferences,
      isEmailVerified:user.isEmailVerified,createdAt:user.createdAt};
  },
  async updateProfile(userId:string,data:{name?:string;preferences?:Record<string,unknown>}) {
    const user=await User.findOne({_id:userId,isAccountDeleted:false});
    if(!user) throw new NotFoundError('User not found');
    if(data.name!==undefined)user.name=data.name;
    if(data.preferences)Object.assign(user.preferences,data.preferences);
    await user.save();return this.getProfile(userId);
  },
  async deleteAccount(userId:string) {
    const user=await User.findOne({_id:userId,isAccountDeleted:false}).select('+googleId');
    if(!user?.googleId) throw new ForbiddenError('Sign in with Google before deleting your account');
    await deleteUserData(userId);
    await Session.deleteMany({userId});
    await User.updateOne({_id:userId},{$set:{isAccountDeleted:true,accountDeletedAt:new Date(),
      email:'deleted-'+userId+'@example.invalid',name:'Deleted account'},
      $unset:{googleId:1,passwordHash:1,emailVerificationToken:1,passwordResetToken:1}});
    return {success:true,message:'Account deleted successfully'};
  },
};
