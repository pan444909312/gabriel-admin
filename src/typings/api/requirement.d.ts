declare namespace Api {
  namespace Requirement {
    type Status = 0 | 1 | 2 | 3 | 4 | 5;

    interface Item {
      id: number;
      name: string;
      status: Status;
      requirementFilePath: string | null;
      features: string | null;
      errorMessage: string | null;
      createTime: string;
    }

    type PageParams = Api.Common.CommonSearchParams & { name?: string };
    type PageResult = Api.Common.PaginatingQueryRecord<Item>;
  }
}
